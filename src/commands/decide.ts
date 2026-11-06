import { z } from 'zod';

import { runEffects } from '../effects.js';
import type { CaptureRow } from '../triage/capture.js';
import { DoubtDecisionSchema, FileDecisionSchema } from '../triage/decision.js';
import { isAnswer } from '../triage/status.js';
import { transition, type Event } from '../triage/transition.js';
import { EXIT_OK, reportRejection, rowForId, UsageError, type CommandContext } from './context.js';

/** Parses the one JSON decision object read on stdin (ADR-0002 § Consequences). */
const parsePayload = <T>(schema: z.ZodType<T>, stdin: string): T => {
  let json: unknown;
  try {
    json = JSON.parse(stdin);
  } catch {
    throw new UsageError('stdin must hold one JSON decision object');
  }
  const result = schema.safeParse(json);
  if (!result.success) throw new UsageError(`invalid decision payload: ${z.prettifyError(result.error)}`);
  return result.data;
};

const apply = async (
  context: CommandContext,
  id: string | undefined,
  event: (row: CaptureRow | undefined) => Event,
  dryRun: boolean,
): Promise<number> => {
  const row = rowForId(context, id);
  const result = transition(row, event(row));
  if (!result.ok) return reportRejection(context, result);
  await runEffects(result.effects, { ...context, print: context.out }, dryRun);
  context.out(JSON.stringify({ id, status: dryRun ? (row?.status ?? 'none') : result.next, dryRun }));
  return EXIT_OK;
};

/** `file <id>`: Inbox → Triaged, or a correction on a triaged capture (T-3, T-8). */
export const file = (context: CommandContext, id: string | undefined, stdin: string): Promise<number> => {
  rowForId(context, id);
  const decision = parsePayload(FileDecisionSchema, stdin);
  return apply(context, id, () => ({ type: 'file', decision, timestamp: context.now().toISOString() }), false);
};

/** `doubt <id>`: Inbox → Doubtful, index only (T-4). */
export const doubt = (context: CommandContext, id: string | undefined, stdin: string): Promise<number> => {
  rowForId(context, id);
  const decision = parsePayload(DoubtDecisionSchema, stdin);
  return apply(context, id, () => ({ type: 'doubt', decision }), false);
};

/** `resolve <id> --as work|personal|delete [--dry-run]` (SEQ-resolve-doubt). */
export const resolve = (context: CommandContext, id: string | undefined, answer: string | undefined): Promise<number> => {
  rowForId(context, id);
  if (answer === undefined || !isAnswer(answer)) throw new UsageError('--as must be work, personal or delete');
  if (answer !== 'work' && context.source === undefined) throw new UsageError('this command needs --source <dir>');
  const duplicates = (row: CaptureRow | undefined): readonly CaptureRow[] =>
    row === undefined ? [] : context.index.duplicatesOf(row.ref);
  return apply(
    context,
    id,
    (row) => ({ type: 'resolve', answer, duplicates: duplicates(row) }),
    answer !== 'work' && context.dryRun,
  );
};
