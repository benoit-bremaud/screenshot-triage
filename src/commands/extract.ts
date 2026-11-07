import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';

import { runEffects } from '../effects.js';
import { isMissing } from '../fs.js';
import { uncitedNotes, type SkillNotes } from '../extract/notes.js';
import { SheetPayloadSchema } from '../extract/payload.js';
import { parseSheet, renderSheet, type ParsedSheet } from '../extract/render.js';
import { idOf } from '../triage/capture.js';
import { DOMAINS } from '../triage/domains.js';
import { transition } from '../triage/transition.js';
import { EXIT_OK, reportRejection, requireSource, rowForId, UsageError, type CommandContext } from './context.js';

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
  context.out(JSON.stringify({ id, status: context.dryRun ? row?.status : result.next, sheet: sheetPath, dryRun: context.dryRun }));
  return EXIT_OK;
};

/**
 * `purge [--dry-run]` (UC5, REQ-14): every extracted capture and its duplicates become `deleted`. A failed
 * capture is reported and the purge goes on; its row stays `extracted`, so a re-run completes it.
 */
export const purge = async (context: CommandContext): Promise<number> => {
  requireSource(context);
  const extracted = context.index.all().filter((row) => row.status === 'extracted');
  let purged = 0;
  const failed: string[] = [];
  for (const row of extracted) {
    const result = transition(row, { type: 'purge', duplicates: context.index.duplicatesOf(row.ref) });
    if (!result.ok) continue;
    try {
      await runEffects(result.effects, context);
      purged += 1;
    } catch (error) {
      failed.push(idOf(row.contentHash));
      context.err(`purge of ${idOf(row.contentHash)} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  context.out(JSON.stringify({ purged, failed, dryRun: context.dryRun }));
  return EXIT_OK;
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

/** `git show origin/main:<path>`, or undefined when the path does not exist there. */
const showOnMain = async (top: string, path: string): Promise<string | undefined> => {
  try {
    return (await run('git', ['-C', top, 'show', `origin/main:${path}`], { maxBuffer: 16 * 1024 * 1024 })).stdout;
  } catch {
    return undefined;
  }
};

/**
 * `notes --skills-dir DIR` (UC6): fetches `origin` of DIR's repository and reads each target skill's
 * `references/field-notes.md` from `origin/main`, never from a working tree; writes nothing.
 */
export const notes = async (context: CommandContext, skillsDir: string | undefined): Promise<number> => {
  if (skillsDir === undefined) throw new UsageError('notes needs --skills-dir <dir>');
  const git = async (...args: string[]): Promise<string> =>
    (await run('git', ['-C', skillsDir, ...args])).stdout.trim();
  let top: string;
  let prefix: string;
  try {
    top = await git('rev-parse', '--show-toplevel');
    prefix = await git('rev-parse', '--show-prefix');
  } catch {
    throw new UsageError('--skills-dir must sit inside a git repository');
  }
  await git('fetch', '--quiet', 'origin');
  const sheets = await readSheets(context.knowledgeDir);
  // Target skills are kebab-case (checked by `parseSheet`), so they never escape the skills folder.
  const skills = [...new Set(sheets.map((sheet) => sheet.targetSkill))];
  const fieldNotes = new Map<string, string>();
  const candidates: string[] = [];
  for (const skill of skills) {
    fieldNotes.set(skill, (await showOnMain(top, `${prefix}${skill}/references/field-notes.md`)) ?? '');
    if ((await showOnMain(top, `${prefix}${skill}/SKILL.md`)) === undefined) candidates.push(skill);
  }
  const report: NotesReport = {
    skills: uncitedNotes(sheets, (skill) => fieldNotes.get(skill) ?? ''),
    candidates: candidates.sort(),
  };
  context.out(JSON.stringify(report));
  return EXIT_OK;
};
