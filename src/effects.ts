import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { exists, isExisting } from './fs.js';
import type { CaptureSource } from './sources/capture-source.js';
import type { CaptureIndex } from './store/capture-index.js';
import type { DecisionLog } from './store/decision-log.js';
import { contentHashOf } from './triage/capture.js';
import { DOMAINS } from './triage/domains.js';
import { describeEffect, type Effect } from './triage/effects.js';
import { renderThumbnail } from './thumbnail.js';

/** Where `scan` copies new captures, under `data/`. */
export const INBOX_FOLDER = 'inbox';
/** Where design gem thumbnails go, under `data/` (git-ignored, NFR-1). */
export const THUMBNAILS_FOLDER = 'thumbnails';

/** Where the thumbnail of a capture is written; `extract` reports it when present. */
export const thumbnailPath = (dataDir: string, id: string): string => join(dataDir, THUMBNAILS_FOLDER, `${id}.jpg`);

/** Where the sheet of a capture is written (ADR-0003 decision 1); `purge` checks it exists before deleting. */
export const sheetPath = (knowledgeDir: string, domain: string, id: string): string => join(knowledgeDir, domain, `${id}.md`);

/**
 * A thumbnail is a convenience: an undecodable image is reported as `thumbnail: null` and the sheet and
 * the row still land. A file-system error propagates, so the row stays `triaged` and a re-run retries.
 */
const writeThumbnailOf = async (deps: EffectDeps, localName: string, id: string): Promise<void> => {
  const from = await locateLocal(deps.dataDir, localName);
  if (from === undefined) throw new Error(`local copy ${localName} not found`);
  await mkdir(join(deps.dataDir, THUMBNAILS_FOLDER), { recursive: true });
  let jpeg: Buffer;
  try {
    jpeg = await renderThumbnail(from);
  } catch {
    await rm(thumbnailPath(deps.dataDir, id), { force: true });
    return;
  }
  await writeAtomic(thumbnailPath(deps.dataDir, id), jpeg);
};

/** Writes through a temporary file, so a crash never leaves a half-written sheet or thumbnail. */
const writeAtomic = async (path: string, content: string | Uint8Array): Promise<void> => {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, content);
  await rename(tmp, path);
};

/** What the runner needs; `src/cli.ts` builds it once per command. */
export interface EffectDeps {
  readonly dataDir: string;
  /** Root of the published sheets, `knowledge/` by default. */
  readonly knowledgeDir: string;
  readonly source: CaptureSource | undefined;
  readonly index: CaptureIndex;
  readonly log: DecisionLog;
  /** With `--dry-run` every effect is printed through `out` and nothing is applied. */
  readonly dryRun: boolean;
  readonly out: (line: string) => void;
}

/**
 * Runs the effects of a transition in order, or prints them with `--dry-run` (REQ-6).
 * File-system effects run here; store effects go through `src/store/`. A dry run still stages
 * index rows in memory so a later effect of the same command sees the earlier ones.
 */
export const runEffects = async (effects: readonly Effect[], deps: EffectDeps): Promise<void> => {
  for (const effect of effects) {
    if (deps.dryRun) {
      deps.out(`dry-run: ${describeEffect(effect)}`);
      if (effect.kind === 'index-write') deps.index.stage(effect.row);
      continue;
    }
    await run(effect, deps);
  }
};

const run = async (effect: Effect, deps: EffectDeps): Promise<void> => {
  switch (effect.kind) {
    case 'copy-to-inbox':
      return copyToInbox(deps, effect.ref, effect.contentHash, effect.localName);
    case 'move-to-domain':
      return moveToDomain(deps.dataDir, effect.domain, effect.localName);
    case 'delete-local':
      // Every copy: a personal capture leaves no bytes under `data/` (REQ-5).
      await Promise.all((await localCopies(deps.dataDir, effect.localName)).map((path) => rm(path)));
      return;
    case 'source-mark-personal':
      return requireSource(deps).markPersonal(effect.ref, effect.target);
    case 'source-trash':
      return requireSource(deps).trash(effect.ref, effect.target);
    case 'source-archive':
      return requireSource(deps).archive(effect.ref, effect.target);
    case 'log-append':
      return deps.log.append(effect.line);
    case 'index-write':
      return deps.index.upsert(effect.row);
    case 'write-sheet':
      await mkdir(join(deps.knowledgeDir, effect.domain), { recursive: true });
      await writeAtomic(sheetPath(deps.knowledgeDir, effect.domain, effect.id), effect.markdown);
      return;
    case 'write-thumbnail':
      return writeThumbnailOf(deps, effect.localName, effect.id);
    case 'remove-sheet':
      await rm(sheetPath(deps.knowledgeDir, effect.domain, effect.id), { force: true });
      return;
    case 'remove-thumbnail':
      await rm(thumbnailPath(deps.dataDir, effect.id), { force: true });
      return;
  }
};

const copyToInbox = async (deps: EffectDeps, ref: string, contentHash: string, localName: string): Promise<void> => {
  const bytes = await requireSource(deps).read(ref);
  // The file may have changed since `scan` hashed it: never copy bytes the index does not describe.
  if (contentHashOf(bytes) !== contentHash) throw new Error(`capture ${localName} changed during scan; scan again`);
  await mkdir(join(deps.dataDir, INBOX_FOLDER), { recursive: true });
  const path = join(deps.dataDir, INBOX_FOLDER, localName);
  // `wx`: never overwrite a local copy. One left by a lost index is kept when its bytes are identical.
  try {
    await writeFile(path, bytes, { flag: 'wx' });
  } catch (error) {
    if (!isExisting(error) || !Buffer.from(bytes).equals(await readFile(path))) throw error;
  }
};

const moveToDomain = async (dataDir: string, domain: string, localName: string): Promise<void> => {
  const from = await locateLocal(dataDir, localName);
  if (from === undefined) throw new Error(`local copy ${localName} not found`);
  const to = join(dataDir, domain, localName);
  await mkdir(join(dataDir, domain), { recursive: true });
  await rename(from, to);
  // A copy left in another folder (a capture moved back out of the archive) is the same bytes: one copy stays.
  const others = (await localCopies(dataDir, localName)).filter((path) => path !== to);
  await Promise.all(others.map((path) => rm(path)));
};

/** The commands check `--source` before running; this guards the runner's own invariant. */
const requireSource = (deps: EffectDeps): CaptureSource => {
  if (deps.source === undefined) throw new Error('effect needs a source');
  return deps.source;
};

/** Every local copy of a capture, in `data/inbox/` then the domain folders (ADR-0002 § Consequences). */
const localCopies = async (dataDir: string, localName: string): Promise<string[]> => {
  const candidates = [INBOX_FOLDER, ...DOMAINS].map((folder) => join(dataDir, folder, localName));
  const present = await Promise.all(candidates.map((candidate) => exists(candidate)));
  return candidates.filter((_, index) => present[index]);
};

/** The first local copy of a capture: `data/inbox/` first, then one domain folder. */
export const locateLocal = async (dataDir: string, localName: string): Promise<string | undefined> =>
  (await localCopies(dataDir, localName))[0];
