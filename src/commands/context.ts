import type { CaptureSource } from '../sources/capture-source.js';
import type { CaptureIndex } from '../store/capture-index.js';
import type { DecisionLog } from '../store/decision-log.js';
import { isCaptureId, type CaptureRow } from '../triage/capture.js';
import type { Transition } from '../triage/transition.js';

/** Everything a command needs, wired by `src/cli.ts` (the composition root). */
export interface CommandContext {
  readonly dataDir: string;
  readonly source: CaptureSource | undefined;
  readonly index: CaptureIndex;
  readonly log: DecisionLog;
  readonly dryRun: boolean;
  readonly now: () => Date;
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

/** Exit codes: 0 done, 1 rejected (REQ-8), 2 usage. */
export const EXIT_OK = 0;
export const EXIT_REJECTED = 1;
export const EXIT_USAGE = 2;

export class UsageError extends Error {}

/** Resolves the id on argv to its addressable row; anything else is a usage error (REQ-9). */
export const rowForId = (context: CommandContext, id: string | undefined): CaptureRow | undefined => {
  if (id === undefined || !isCaptureId(id)) {
    throw new UsageError('expected a capture id: 12 hex characters, never a filename or a ref');
  }
  return context.index.byId(id);
};

export const reportRejection = (context: CommandContext, result: Extract<Transition, { ok: false }>): number => {
  context.err(`rejected: ${result.reason} (current status: ${result.current ?? 'none'})`);
  return EXIT_REJECTED;
};
