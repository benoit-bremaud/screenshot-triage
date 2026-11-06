import { localName, targetOf, type CaptureRow } from './capture.js';
import type { DecisionLine, DoubtDecision, FileDecision } from './decision.js';
import type { Effect } from './effects.js';
import type { ImageExt } from './image.js';
import { isFinal, type Answer, type Status } from './status.js';

/** A capture seen by `scan`, already read and hashed by the caller. */
export interface ScanCandidate {
  readonly ref: string;
  readonly name: string;
  readonly takenAt: string;
  readonly size: number;
  readonly contentHash: string;
  readonly ext: ImageExt;
  readonly ocrText?: string;
}

/** The facts the four `scan` guards read, gathered by the caller (05-state-capture § Notes). */
export interface ScanFacts {
  /** Index rows sharing the candidate's hash. */
  readonly sameHash: readonly CaptureRow[];
  /** The candidate's id sits in the source's `Personnel/` (content never read). */
  readonly personalAtSource: boolean;
  /** The candidate's id sits in the source's `.trash/`. */
  readonly trashedAtSource: boolean;
}

export type Event =
  | { readonly type: 'scan'; readonly candidate: ScanCandidate; readonly facts: ScanFacts }
  | { readonly type: 'file'; readonly decision: FileDecision; readonly timestamp: string }
  | { readonly type: 'doubt'; readonly decision: DoubtDecision }
  | { readonly type: 'resolve'; readonly answer: Answer; readonly duplicates: readonly CaptureRow[] };

export type Transition =
  | { readonly ok: true; readonly next: Status; readonly effects: readonly Effect[] }
  | { readonly ok: false; readonly current: Status | undefined; readonly reason: string };

/** The model name an owner correction carries (glossary "Correction"). */
export const OWNER_MODEL = 'owner';

const reject = (capture: CaptureRow | undefined, reason: string): Transition => ({
  ok: false,
  current: capture?.status,
  reason,
});

const ok = (next: Status, effects: readonly Effect[]): Transition => ({ ok: true, next, effects });

/** `scan` replaces a row only when its ref came back after a final status (restored or re-synced file). */
export const scanRevisits = (row: CaptureRow | undefined): boolean =>
  row === undefined || row.status === 'deleted' || row.status === 'personal';

/** The capture state machine of `05-state-capture.md`: pure, every effect returned in order. */
export const transition = (capture: CaptureRow | undefined, event: Event): Transition => {
  switch (event.type) {
    case 'scan':
      return scan(capture, event.candidate, event.facts);
    case 'file':
      return file(capture, event.decision, event.timestamp);
    case 'doubt':
      return doubt(capture, event.decision);
    case 'resolve':
      return resolve(capture, event.answer, event.duplicates);
  }
};

/** Private text about a capture the owner declared personal never stays in the index (REQ-5). */
const withoutPrivateText = (row: CaptureRow): CaptureRow => {
  const { reasoning: _reasoning, ocrText: _ocrText, category: _category, ...rest } = row;
  return rest;
};

const scan = (capture: CaptureRow | undefined, candidate: ScanCandidate, facts: ScanFacts): Transition => {
  if (!scanRevisits(capture)) return reject(capture, 'scan only creates a row or replaces a final one');
  const base: CaptureRow = { ...candidate, status: 'inbox' };
  const name = localName(candidate);
  const target = targetOf(base);
  // Guard order is a spec clause: Personal, Deleted, Duplicate, then Inbox (05-state-capture § Notes, T-14).
  // `duplicateOf` falls back to the row's own ref when only the source holds the original (lost index).
  const personalOriginal = facts.sameHash.find((row) => row.status === 'personal');
  if (personalOriginal !== undefined || facts.personalAtSource) {
    const row = withoutPrivateText({ ...base, status: 'personal', duplicateOf: personalOriginal?.ref ?? candidate.ref });
    return ok('personal', [
      { kind: 'source-mark-personal', ref: candidate.ref, target },
      { kind: 'index-write', row },
    ]);
  }
  if (facts.trashedAtSource) {
    const deletedOriginal = facts.sameHash.find((row) => row.status === 'deleted');
    const row: CaptureRow = { ...base, status: 'deleted', duplicateOf: deletedOriginal?.ref ?? candidate.ref };
    return ok('deleted', [
      { kind: 'source-trash', ref: candidate.ref, target },
      { kind: 'index-write', row },
    ]);
  }
  const original = facts.sameHash.find(
    (row) => !isFinal(row.status) && row.status !== 'duplicate' && row.ref !== candidate.ref,
  );
  if (original !== undefined) {
    const row: CaptureRow = { ...base, status: 'duplicate', duplicateOf: original.ref };
    return ok('duplicate', [{ kind: 'index-write', row }]);
  }
  return ok('inbox', [
    { kind: 'copy-to-inbox', ref: candidate.ref, localName: name },
    { kind: 'index-write', row: base },
  ]);
};

const file = (capture: CaptureRow | undefined, decision: FileDecision, timestamp: string): Transition => {
  if (capture === undefined) return reject(capture, 'unknown capture');
  if (capture.status !== 'inbox' && capture.status !== 'triaged') {
    return reject(capture, 'file applies to an inbox or triaged capture');
  }
  const correction = capture.status === 'triaged';
  if (correction && (decision.model !== OWNER_MODEL || decision.confidence !== undefined)) {
    return reject(capture, `a correction carries model "${OWNER_MODEL}" and no confidence`);
  }
  // The answer label brick 6 values: `work` after a doubt the owner kept, `correction` on an owner re-file.
  let answer: DecisionLine['answer'] | undefined;
  if (correction) answer = 'correction';
  else if (capture.doubtAnswer === 'work') answer = 'work';
  const line: DecisionLine = {
    contentHash: capture.contentHash,
    timestamp,
    promptVersion: decision.promptVersion,
    model: decision.model,
    domain: decision.domain,
    tags: decision.tags,
    consideredTags: decision.consideredTags,
    ...(decision.confidence === undefined ? {} : { confidence: decision.confidence }),
    ...(answer === undefined ? {} : { answer }),
  };
  const { category: _category, error: _error, ...kept } = capture;
  const row: CaptureRow = {
    ...kept,
    status: 'triaged',
    domain: decision.domain,
    tags: decision.tags,
    reasoning: decision.reasoning,
  };
  return ok('triaged', [
    { kind: 'move-to-domain', localName: localName(capture), domain: decision.domain },
    { kind: 'log-append', line },
    { kind: 'index-write', row },
  ]);
};

const doubt = (capture: CaptureRow | undefined, decision: DoubtDecision): Transition => {
  if (capture === undefined) return reject(capture, 'unknown capture');
  if (capture.status !== 'inbox') return reject(capture, 'doubt applies to an inbox capture');
  if (capture.doubtAnswer === 'work') return reject(capture, 'the owner already kept this capture as work');
  const row: CaptureRow = {
    ...capture,
    status: 'doubtful',
    category: decision.category,
    reasoning: decision.reasoning,
  };
  return ok('doubtful', [{ kind: 'index-write', row }]);
};

const resolve = (capture: CaptureRow | undefined, answer: Answer, duplicates: readonly CaptureRow[]): Transition => {
  if (capture === undefined) return reject(capture, 'unknown capture');
  if (capture.status !== 'doubtful') return reject(capture, 'resolve applies to a doubtful capture');
  if (answer === 'work') {
    return ok('inbox', [{ kind: 'index-write', row: { ...capture, status: 'inbox', doubtAnswer: 'work' } }]);
  }
  const next: Status = answer === 'personal' ? 'personal' : 'deleted';
  const sourceKind = answer === 'personal' ? 'source-mark-personal' : 'source-trash';
  // The primary row is written last: while it is still doubtful, a failed duplicate leaves a re-runnable `resolve`.
  const effects: Effect[] = [
    { kind: 'delete-local', localName: localName(capture) },
    { kind: sourceKind, ref: capture.ref, target: targetOf(capture) },
  ];
  for (const duplicate of duplicates) {
    effects.push(
      { kind: sourceKind, ref: duplicate.ref, target: targetOf(duplicate) },
      { kind: 'index-write', row: withoutPrivateText({ ...duplicate, status: next }) },
    );
  }
  effects.push({ kind: 'index-write', row: withoutPrivateText({ ...capture, status: next, doubtAnswer: answer }) });
  return ok(next, effects);
};
