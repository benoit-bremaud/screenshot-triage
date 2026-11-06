import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { CaptureSource } from './sources/capture-source.js';
import type { CaptureIndex } from './store/capture-index.js';
import type { DecisionLog } from './store/decision-log.js';
import { DOMAINS } from './triage/domains.js';
import { describeEffect, type Effect } from './triage/effects.js';

export const INBOX_FOLDER = 'inbox';

export interface EffectDeps {
  readonly dataDir: string;
  readonly source: CaptureSource | undefined;
  readonly index: CaptureIndex;
  readonly log: DecisionLog;
  readonly print: (line: string) => void;
}

/**
 * Runs the effects of a transition in order, or prints them with `--dry-run` (REQ-6).
 * File-system effects run here; store effects go through `src/store/`.
 */
export const runEffects = async (effects: readonly Effect[], deps: EffectDeps, dryRun: boolean): Promise<void> => {
  if (dryRun) {
    for (const effect of effects) deps.print(`dry-run: ${describeEffect(effect)}`);
    return;
  }
  for (const effect of effects) await run(effect, deps);
};

const run = async (effect: Effect, deps: EffectDeps): Promise<void> => {
  switch (effect.kind) {
    case 'copy-to-inbox': {
      const bytes = await requireSource(deps).read(effect.ref);
      await mkdir(join(deps.dataDir, INBOX_FOLDER), { recursive: true });
      await writeFile(join(deps.dataDir, INBOX_FOLDER, effect.localName), bytes);
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
      return requireSource(deps).markPersonal(effect.ref, effect.localName);
    case 'source-trash':
      return requireSource(deps).trash(effect.ref, effect.localName);
    case 'log-append':
      await deps.log.append(effect.line);
      return;
    case 'index-write':
      return deps.index.upsert(effect.row);
  }
};

const requireSource = (deps: EffectDeps): CaptureSource => {
  if (deps.source === undefined) throw new Error('this command needs --source');
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

const exists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
};
