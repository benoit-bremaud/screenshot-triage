import { join } from 'node:path';

import { INBOX_FOLDER, locateLocal, type EffectDeps } from '../effects.js';
import type { CaptureSource } from '../sources/capture-source.js';
import { idOf, isCaptureId, localName, type CaptureRow } from '../triage/capture.js';
import type { Answer } from '../triage/status.js';
import type { Transition } from '../triage/transition.js';

/** Everything a command needs, wired by `src/cli.ts` (the composition root). */
export interface CommandContext extends EffectDeps {
  /** Injected clock: timestamps of log lines and the 90-day rule. */
  readonly now: () => Date;
  readonly err: (line: string) => void;
}

/** Exit codes: 0 done, 1 rejected transition (REQ-8), 2 usage, 3 unexpected error. */
export const EXIT_OK = 0;
export const EXIT_REJECTED = 1;
export const EXIT_USAGE = 2;
export const EXIT_INTERNAL = 3;

/** A wrong invocation: bad id, bad flag, invalid payload; reported with the usage, exit 2. */
export class UsageError extends Error {}

/**
 * Resolves the id on argv to its addressable row (REQ-9). Anything but 12 hex characters is a
 * usage error. When no row is addressable, the latest row carrying the id is returned so the
 * transition can report the current status (REQ-8).
 */
export const rowForId = (context: CommandContext, id: string | undefined): CaptureRow | undefined => {
  if (id === undefined || !isCaptureId(id)) {
    throw new UsageError('expected a capture id: 12 hex characters, never a filename or a ref');
  }
  return context.index.byId(id) ?? context.index.latestById(id);
};

export const requireSource = (context: CommandContext): CaptureSource => {
  if (context.source === undefined) throw new UsageError('this command needs --source <dir>');
  return context.source;
};

/** Prints a rejected transition on stderr with the current status and returns exit 1. */
export const reportRejection = (context: CommandContext, result: Extract<Transition, { ok: false }>): number => {
  context.err(`rejected: ${result.reason} (current status: ${result.current ?? 'none'})`);
  return EXIT_REJECTED;
};

/** A capture as `scan` and `status` present it to the skill: id and local path, never a source name. */
export interface CaptureEntry {
  readonly id: string;
  readonly path: string;
  readonly ocrText?: string;
  readonly doubtAnswer?: Answer;
}

/** The local copy normally sits in `data/inbox/`; after a half-done `file` it may sit in a domain folder. */
export const entryOf = async (context: CommandContext, row: CaptureRow): Promise<CaptureEntry> => ({
  id: idOf(row.contentHash),
  path: (await locateLocal(context.dataDir, localName(row))) ?? join(context.dataDir, INBOX_FOLDER, localName(row)),
  ...(row.ocrText === undefined ? {} : { ocrText: row.ocrText }),
  ...(row.doubtAnswer === undefined ? {} : { doubtAnswer: row.doubtAnswer }),
});
