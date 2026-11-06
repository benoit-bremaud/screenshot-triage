import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { exists, isExisting } from './fs.js';
import type { CaptureSource } from './sources/capture-source.js';
import type { CaptureIndex } from './store/capture-index.js';
import type { DecisionLog } from './store/decision-log.js';
import { contentHashOf } from './triage/capture.js';
import { DOMAINS } from './triage/domains.js';
import { describeEffect, type Effect } from './triage/effects.js';

export const INBOX_FOLDER = 'inbox';

/** What the runner needs; `src/cli.ts` builds it once per command. */
export interface EffectDeps {
  readonly dataDir: string;
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
    case 'copy-to-inbox': {
      const bytes = await requireSource(deps).read(effect.ref);
      // The file may have changed since `scan` hashed it: never copy bytes the index does not describe.
      if (contentHashOf(bytes) !== effect.contentHash) throw new Error(`capture ${effect.localName} changed during scan; scan again`);
      await mkdir(join(deps.dataDir, INBOX_FOLDER), { recursive: true });
      const path = join(deps.dataDir, INBOX_FOLDER, effect.localName);
      // `wx`: never overwrite a local copy. One left by a lost index is kept when its bytes are identical.
      try {
        await writeFile(path, bytes, { flag: 'wx' });
      } catch (error) {
        if (!isExisting(error) || !Buffer.from(bytes).equals(await readFile(path))) throw error;
      }
      return;
    }
    case 'move-to-domain': {
      const from = await locateLocal(deps.dataDir, effect.localName);
      if (from === undefined) throw new Error(`local copy ${effect.localName} not found`);
      await mkdir(join(deps.dataDir, effect.domain), { recursive: true });
      await rename(from, join(deps.dataDir, effect.domain, effect.localName));
      return;
    }
    case 'delete-local': {
      const path = await locateLocal(deps.dataDir, effect.localName);
      if (path !== undefined) await rm(path);
      return;
    }
    case 'source-mark-personal':
      return requireSource(deps).markPersonal(effect.ref, effect.target);
    case 'source-trash':
      return requireSource(deps).trash(effect.ref, effect.target);
    case 'log-append':
      return deps.log.append(effect.line);
    case 'index-write':
      return deps.index.upsert(effect.row);
  }
};

/** The commands check `--source` before running; this guards the runner's own invariant. */
const requireSource = (deps: EffectDeps): CaptureSource => {
  if (deps.source === undefined) throw new Error('effect needs a source');
  return deps.source;
};

/** A local copy sits in `data/inbox/` or in one domain folder (ADR-0002 § Consequences). */
export const locateLocal = async (dataDir: string, localName: string): Promise<string | undefined> => {
  for (const folder of [INBOX_FOLDER, ...DOMAINS]) {
    const candidate = join(dataDir, folder, localName);
    if (await exists(candidate)) return candidate;
  }
  return undefined;
};
