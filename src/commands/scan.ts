import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { INBOX_FOLDER, runEffects } from '../effects.js';
import type { CaptureSource } from '../sources/capture-source.js';
import { idOf, localName, type CaptureRow } from '../triage/capture.js';
import { detectImageExt } from '../triage/image.js';
import { transition, type ScanCandidate } from '../triage/transition.js';
import { EXIT_OK, UsageError, type CommandContext } from './context.js';

export interface InboxEntry {
  readonly id: string;
  readonly path: string;
  readonly ocrText?: string;
  readonly doubtAnswer?: string;
}

export interface ScanReport {
  readonly inbox: readonly InboxEntry[];
  /** Candidates whose bytes are not a whitelisted image; reported on every scan (UC1 ext. 2b). */
  readonly rejected: number;
  readonly seen: Record<string, number>;
}

/** UC1 steps 2 and extensions 2a, 2b: SEQ-triage-batch. */
export const scan = async (context: CommandContext): Promise<number> => {
  const source = requireSource(context);
  const finalIds = await source.finalIds();
  const seen: Record<string, number> = {};
  let rejected = 0;
  for (const capture of await source.listCaptures()) {
    const existing = context.index.byRef(capture.ref);
    if (existing !== undefined && existing.status !== 'deleted') continue;
    const bytes = await source.read(capture.ref);
    const ext = detectImageExt(bytes);
    if (ext === undefined) {
      rejected += 1;
      continue;
    }
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    const candidate: ScanCandidate = { ...capture, contentHash, ext };
    const id = idOf(contentHash);
    const result = transition(existing, {
      type: 'scan',
      candidate,
      facts: {
        sameHash: context.index.byHash(contentHash),
        personalAtSource: finalIds.personal.has(id),
        trashedAtSource: finalIds.trashed.has(id),
      },
    });
    if (!result.ok) throw new Error(result.reason);
    await runEffects(result.effects, { ...context, print: context.out }, context.dryRun);
    seen[result.next] = (seen[result.next] ?? 0) + 1;
  }
  const report: ScanReport = { inbox: inboxEntries(context), rejected, seen };
  context.out(JSON.stringify(report));
  return EXIT_OK;
};

export const inboxEntries = (context: CommandContext): InboxEntry[] =>
  context.index
    .all()
    .filter((row) => row.status === 'inbox')
    .map((row) => entry(context.dataDir, row));

export const entry = (dataDir: string, row: CaptureRow): InboxEntry => ({
  id: idOf(row.contentHash),
  path: join(dataDir, row.status === 'triaged' && row.domain !== undefined ? row.domain : INBOX_FOLDER, localName(row)),
  ...(row.ocrText === undefined ? {} : { ocrText: row.ocrText }),
  ...(row.doubtAnswer === undefined ? {} : { doubtAnswer: row.doubtAnswer }),
});

export const requireSource = (context: CommandContext): CaptureSource => {
  if (context.source === undefined) throw new UsageError('this command needs --source <dir>');
  return context.source;
};
