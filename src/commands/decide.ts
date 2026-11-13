import { z } from 'zod';

import { runEffects } from '../effects.js';
import type { CaptureRow } from '../triage/capture.js';
import { DoubtDecisionSchema, FileDecisionSchema } from '../triage/decision.js';
import { isAnswer } from '../triage/status.js';
import { transition, type Event } from '../triage/transition.js';
import { EXIT_OK, reportRejection, requireSource, rowForId, UsageError, type CommandContext } from './context.js';

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
  id: string,
  row: CaptureRow | undefined,
  event: Event,
  dryRun: boolean,
): Promise<number> => {
  const result = transition(row, event);
  if (!result.ok) return reportRejection(context, result);
  try {
    await runEffects(result.effects, { ...context, dryRun });
  } catch (error) {
    // UC1 ext. 5a: a failed move leaves the row `inbox` with an error flag; the next `scan` presents it again.
    // Best effort: the original error is the one reported.
    if (event.type === 'file' && row?.status === 'inbox') {
      await context.index.upsert({ ...row, error: 'move failed' }).catch(() => undefined);
    }
    throw error;
  }
  context.out(JSON.stringify({ id, status: dryRun ? (row?.status ?? 'none') : result.next, dryRun }));
  return EXIT_OK;
};

/** `file <id>`: Inbox → Triaged, or an owner correction on a triaged capture (T-3, T-8). */
export const file = (context: CommandContext, id: string | undefined, stdin: string): Promise<number> => {
  const row = rowForId(context, id);
  const decision = parsePayload(FileDecisionSchema, stdin);
  const event: Event = { type: 'file', decision, timestamp: context.now().toISOString() };
  return apply(context, id ?? '', row, event, context.dryRun);
};

/** `doubt <id>`: Inbox → Doubtful, index only (T-4). */
export const doubt = (context: CommandContext, id: string | undefined, stdin: string): Promise<number> => {
  const row = rowForId(context, id);
  const decision = parsePayload(DoubtDecisionSchema, stdin);
  return apply(context, id ?? '', row, { type: 'doubt', decision }, context.dryRun);
};

/**
 * `resolve <id> --as work|personal|delete [--dry-run]` (SEQ-resolve-doubt); personal and delete also on a
 * triaged capture (REQ-16) and on an archived one (ADR-0004). `work` has no destructive
 * effect, so it ignores `--dry-run` and needs no `--source`.
 */
export const resolve = (context: CommandContext, id: string | undefined, answer: string | undefined): Promise<number> => {
  const row = rowForId(context, id);
  if (answer === undefined || !isAnswer(answer)) throw new UsageError('--as must be work, personal or delete');
  if (answer !== 'work') requireSource(context);
  // An archived capture's copies were archived with it, so they carry `archived` (ADR-0004).
  const duplicates = row === undefined ? [] : context.index.duplicatesOf(row.ref, row.status === 'archived' ? 'archived' : 'duplicate');
  return apply(context, id ?? '', row, { type: 'resolve', answer, duplicates }, answer !== 'work' && context.dryRun);
};
