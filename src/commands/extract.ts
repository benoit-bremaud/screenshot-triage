import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';

import { runEffects, thumbnailPath } from '../effects.js';
import { exists, isMissing } from '../fs.js';
import { uncitedNotes, type SkillNotes } from '../extract/notes.js';
import { SheetPayloadSchema } from '../extract/payload.js';
import { parseSheet, renderSheet, type ParsedSheet } from '../extract/render.js';
import { idOf } from '../triage/capture.js';
import { DOMAINS } from '../triage/domains.js';
import { transition } from '../triage/transition.js';
import { EXIT_INTERNAL, EXIT_OK, reportRejection, requireSource, rowForId, UsageError, type CommandContext } from './context.js';

const run = promisify(execFile);

/** `extract <id> [--dry-run]`: Triaged or Extracted → Extracted, one sheet payload on stdin (UC4, REQ-10). */
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
  const sheetPath = join(context.knowledgeDir, row?.domain ?? '', `${id ?? ''}.md`);
  // A gem without thumbnail (HEIC, undecodable image) is reported as null (ADR-0003 § Thumbnails).
  const wantsThumbnail = result.effects.some((effect) => effect.kind === 'write-thumbnail');
  const thumbnail = thumbnailPath(context.dataDir, id ?? '');
  context.out(
    JSON.stringify({
      id,
      status: context.dryRun ? row?.status : result.next,
      sheet: sheetPath,
      thumbnail: wantsThumbnail && (context.dryRun || (await exists(thumbnail))) ? thumbnail : null,
      ...(sheet.gem === true && !wantsThumbnail ? { gemWithoutThumbnail: true } : {}),
      dryRun: context.dryRun,
    }),
  );
  return EXIT_OK;
};

/**
 * `purge [--dry-run]` (UC5, REQ-14): every extracted capture whose sheet exists, and its duplicates, become
 * `deleted`. A capture without its sheet is skipped (deletion only after a sheet, CLAUDE.md); a failed one is
 * reported, keeps `extracted` with an error flag, and the purge goes on; a re-run completes it. Exit 3 when any failed.
 */
export const purge = async (context: CommandContext): Promise<number> => {
  requireSource(context);
  const extracted = context.index.all().filter((row) => row.status === 'extracted');
  let purged = 0;
  const failed: string[] = [];
  const skipped: string[] = [];
  for (const row of extracted) {
    const id = idOf(row.contentHash);
    if (row.domain === undefined || !(await exists(join(context.knowledgeDir, row.domain, `${id}.md`)))) {
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
      if (!context.dryRun) await context.index.upsert({ ...row, error: 'purge failed' }).catch(() => undefined);
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
  const sheets: ParsedSheet[] = [];
  for (const domain of DOMAINS) {
    let names: string[];
    try {
      names = await readdir(join(knowledgeDir, domain));
    } catch (error) {
      if (isMissing(error)) continue;
      throw error;
    }
    for (const name of names.filter((entry) => /^[0-9a-f]{12}\.md$/.test(entry)).sort()) {
      const sheet = parseSheet(await readFile(join(knowledgeDir, domain, name), 'utf8'));
      if (sheet !== undefined) sheets.push(sheet);
    }
  }
  return sheets;
};

/** git never prompts for credentials: a remote that needs them fails instead of blocking the session. */
const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0' };

const git = async (cwd: string, ...args: string[]): Promise<string> =>
  (await run('git', ['-C', cwd, ...args], { env: GIT_ENV, maxBuffer: 16 * 1024 * 1024 })).stdout;

/** True when `origin/main:<path>` exists; `cat-file -e` fails only for a missing object. */
const onMain = async (top: string, path: string): Promise<boolean> =>
  git(top, 'cat-file', '-e', `origin/main:${path}`).then(
    () => true,
    () => false,
  );

/** `git show origin/main:<path>`, or undefined when `cat-file -e` finds no such object (origin/main itself is verified first). */
const showOnMain = async (top: string, path: string): Promise<string | undefined> =>
  (await onMain(top, path)) ? git(top, 'show', `origin/main:${path}`) : undefined;

/**
 * `notes --skills-dir DIR` (UC6): fetches `origin` of DIR's repository and reads each target skill's
 * `references/field-notes.md` from `origin/main`, never from a working tree; writes nothing.
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
  const fieldNotes = new Map<string, string>();
  const candidates: string[] = [];
  for (const skill of skills) {
    fieldNotes.set(skill, (await showOnMain(top, `${prefix}${skill}/references/field-notes.md`)) ?? '');
    if (!(await onMain(top, `${prefix}${skill}/SKILL.md`))) candidates.push(skill);
  }
  const report: NotesReport = {
    skills: uncitedNotes(sheets, (skill) => fieldNotes.get(skill) ?? ''),
    candidates: candidates.sort(),
  };
  context.out(JSON.stringify(report));
  return EXIT_OK;
};
