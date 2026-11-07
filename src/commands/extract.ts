import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';

import { runEffects, sheetPath, thumbnailPath } from '../effects.js';
import { exists, isMissing } from '../fs.js';
import { uncitedNotes, type SkillNotes } from '../extract/notes.js';
import { SheetPayloadSchema } from '../extract/payload.js';
import { parseSheet, renderSheet, type ParsedSheet } from '../extract/render.js';
import { idOf } from '../triage/capture.js';
import { DOMAINS } from '../triage/domains.js';
import { transition } from '../triage/transition.js';
import { EXIT_INTERNAL, EXIT_OK, reportRejection, requireSource, rowForId, UsageError, type CommandContext } from './context.js';

const run = promisify(execFile);

/**
 * `extract <id> [--dry-run]`: Triaged or Extracted → Extracted, one sheet payload on stdin (UC4, REQ-10).
 * Prints `{id, status, sheet, thumbnail, gemWithoutThumbnail?, dryRun}`; `thumbnail` is null when none was written.
 * @throws UsageError on non-JSON stdin or a payload the schema rejects (exit 2).
 */
export const extract = async (context: CommandContext, id: string | undefined, stdin: string): Promise<number> => {
  const row = rowForId(context, id);
  let json: unknown;
  try {
    json = JSON.parse(stdin);
  } catch {
    throw new UsageError('stdin must hold one JSON sheet object');
  }
  const parsed = SheetPayloadSchema.safeParse(json);
  if (!parsed.success) throw new UsageError(`invalid sheet payload: ${z.prettifyError(parsed.error)}`);
  const sheet = parsed.data;
  // Domain and tags belong to the index row (REQ-2 keeps one owner); the transition rejects a missing or `other` domain.
  const markdown = row === undefined ? '' : renderSheet(idOf(row.contentHash), row.domain ?? 'other', row.tags ?? [], sheet);
  const result = transition(row, { type: 'extract', markdown, gem: sheet.gem === true });
  if (!result.ok) return reportRejection(context, result);
  await runEffects(result.effects, context);
  const sheetFile = sheetPath(context.knowledgeDir, row?.domain ?? '', id ?? '');
  // A gem without thumbnail (HEIC, undecodable image) is reported as null (ADR-0003 § Thumbnails).
  const wantsThumbnail = result.effects.some((effect) => effect.kind === 'write-thumbnail');
  const thumbnail = thumbnailPath(context.dataDir, id ?? '');
  context.out(
    JSON.stringify({
      id,
      status: context.dryRun ? row?.status : result.next,
      sheet: sheetFile,
      thumbnail: wantsThumbnail && (context.dryRun || (await exists(thumbnail))) ? thumbnail : null,
      ...(sheet.gem === true && !wantsThumbnail ? { gemWithoutThumbnail: true } : {}),
      dryRun: context.dryRun,
    }),
  );
  return EXIT_OK;
};

/**
 * `purge --source DIR [--dry-run]` (UC5, REQ-14): every extracted capture whose sheet exists, and its duplicates, become
 * `deleted`. A capture without its sheet is skipped (deletion only after a sheet, CLAUDE.md); a failed one is
 * reported, keeps `extracted` with an error flag, and the purge goes on; a re-run completes it. Prints
 * `{purged, failed, skipped, dryRun}`; exit 3 when any failed.
 */
export const purge = async (context: CommandContext): Promise<number> => {
  requireSource(context);
  const extracted = context.index.all().filter((row) => row.status === 'extracted');
  let purged = 0;
  const failed: string[] = [];
  const skipped: string[] = [];
  // Sequential on purpose: one capture at a time, duplicates before the original's row (ADR-0003), so a
  // crash leaves at most one capture half-purged and a re-run completes it.
  for (const row of extracted) {
    const id = idOf(row.contentHash);
    if (row.domain === undefined || !(await exists(sheetPath(context.knowledgeDir, row.domain, id)))) {
      skipped.push(id);
      context.err(`purge of ${id} skipped: its sheet is missing; extract it again first`);
      continue;
    }
    const result = transition(row, { type: 'purge', duplicates: context.index.duplicatesOf(row.ref) });
    if (!result.ok) continue;
    try {
      await runEffects(result.effects, context);
      purged += 1;
    } catch (error) {
      failed.push(id);
      context.err(`purge of ${id} failed: ${error instanceof Error ? error.message : String(error)}`);
      // UC5 ext. 3a: the row stays `extracted` with the error. Best effort: the original error is the one reported.
      if (!context.dryRun) {
        await context.index.upsert({ ...row, error: 'purge failed' }).catch((flagError: unknown) => {
          context.err(`could not flag ${id}: ${flagError instanceof Error ? flagError.message : String(flagError)}`);
        });
      }
    }
  }
  context.out(JSON.stringify({ purged, failed, skipped, dryRun: context.dryRun }));
  return failed.length > 0 ? EXIT_INTERNAL : EXIT_OK;
};

/** The `notes` report (REQ-15): uncited rules per target skill, and the target skills that do not exist yet. */
export interface NotesReport {
  readonly skills: readonly SkillNotes[];
  readonly candidates: readonly string[];
}

/** Reads every sheet under `knowledge/<domain>/`; a file that is not a sheet is ignored. */
const readSheets = async (knowledgeDir: string): Promise<ParsedSheet[]> => {
  const perDomain = await Promise.all(DOMAINS.map(async (domain) => readDomainSheets(join(knowledgeDir, domain))));
  return perDomain.flat();
};

/** The sheets of one domain folder, by file name; a missing folder holds none. */
const readDomainSheets = async (folder: string): Promise<ParsedSheet[]> => {
  let names: string[];
  try {
    names = await readdir(folder);
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  const sheetNames = names.filter((entry) => /^[0-9a-f]{12}\.md$/.test(entry));
  sheetNames.sort((a, b) => a.localeCompare(b));
  const sheets = await Promise.all(sheetNames.map(async (name) => parseSheet(await readFile(join(folder, name), 'utf8'))));
  return sheets.filter((sheet) => sheet !== undefined);
};

/** git never prompts for credentials, over https or ssh: a remote that needs them fails instead of blocking the session. */
const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' };

/** An unreachable remote fails the fetch after this delay instead of hanging. */
const GIT_TIMEOUT_MS = 60_000;

const git = async (cwd: string, ...args: string[]): Promise<string> =>
  (await run('git', ['-C', cwd, ...args], { env: GIT_ENV, maxBuffer: 16 * 1024 * 1024, timeout: GIT_TIMEOUT_MS })).stdout;

/** True when `origin/main:<path>` exists: `ls-tree` prints nothing for a missing path and fails only on a git error, which is thrown. */
const onMain = async (top: string, path: string): Promise<boolean> =>
  (await git(top, 'ls-tree', '--name-only', 'origin/main', '--', path)).trim() !== '';

/** `git show origin/main:<path>`, or undefined when `ls-tree` finds no such path (origin/main itself is verified first). */
const showOnMain = async (top: string, path: string): Promise<string | undefined> =>
  (await onMain(top, path)) ? git(top, 'show', `origin/main:${path}`) : undefined;

/**
 * `notes --skills-dir DIR` (UC6): fetches `origin` of DIR's repository and reads each target skill's
 * `references/field-notes.md` from `origin/main`, never from a working tree. Prints a {@link NotesReport};
 * the fetch is its only side effect.
 * @throws UsageError when DIR is not inside a git repository or `origin/main` is missing after the fetch.
 */
export const notes = async (context: CommandContext, skillsDir: string | undefined): Promise<number> => {
  if (skillsDir === undefined) throw new UsageError('notes needs --skills-dir <dir>');
  let top: string;
  let prefix: string;
  try {
    top = (await git(skillsDir, 'rev-parse', '--show-toplevel')).trim();
    prefix = (await git(skillsDir, 'rev-parse', '--show-prefix')).trim();
  } catch {
    throw new UsageError('--skills-dir must sit inside a git repository');
  }
  await git(top, 'fetch', '--quiet', 'origin');
  // Without origin/main every rule would look uncited and every skill new: refuse instead.
  try {
    await git(top, 'rev-parse', '--verify', '--quiet', 'origin/main^{commit}');
  } catch {
    throw new UsageError('the skills repository has no origin/main after the fetch');
  }
  const sheets = await readSheets(context.knowledgeDir);
  // Target skills are kebab-case (checked by `parseSheet`), so they never escape the skills folder.
  const skills = [...new Set(sheets.map((sheet) => sheet.targetSkill))];
  const looked = await Promise.all(
    skills.map(async (skill) => ({
      skill,
      notes: (await showOnMain(top, `${prefix}${skill}/references/field-notes.md`)) ?? '',
      exists: await onMain(top, `${prefix}${skill}/SKILL.md`),
    })),
  );
  const fieldNotes = new Map(looked.map(({ skill, notes: text }) => [skill, text]));
  const candidates = looked.filter((entry) => !entry.exists).map((entry) => entry.skill);
  candidates.sort((a, b) => a.localeCompare(b));
  const report: NotesReport = {
    skills: uncitedNotes(sheets, (skill) => fieldNotes.get(skill) ?? ''),
    candidates,
  };
  context.out(JSON.stringify(report));
  return EXIT_OK;
};
