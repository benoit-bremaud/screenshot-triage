import type { Domain } from './domains.js';
import type { ImageExt } from './image.js';
import type { Answer, DoubtCategory, Status } from './status.js';

/** The id is the first 12 hex characters of the content hash: the only identifier on argv (REQ-9). */
export const CAPTURE_ID = /^[0-9a-f]{12}$/;

export const isCaptureId = (value: string): boolean => CAPTURE_ID.test(value);

export const idOf = (contentHash: string): string => contentHash.slice(0, 12);

/**
 * One row of the private index `data/index.jsonl`, keyed by ref (ADR-0002 decision 2).
 * Rows are plain JSON, so every status-specific field is optional; the transition function
 * is the only writer and keeps them consistent with the status.
 */
export interface CaptureRow {
  readonly ref: string;
  readonly name: string;
  /** ISO 8601; the source file's modification time on a local directory. */
  readonly takenAt: string;
  /** Byte length at scan time; with `takenAt`, tells the source when it must hash the file again. */
  readonly size: number;
  readonly contentHash: string;
  readonly ext: ImageExt;
  readonly status: Status;
  readonly ocrText?: string;
  readonly domain?: Domain;
  readonly tags?: readonly string[];
  /** Model-written text: untrusted, stored, never interpreted (ADR-0002 decision 3). */
  readonly reasoning?: string;
  readonly category?: DoubtCategory;
  readonly doubtAnswer?: Answer;
  /** Ref of the original when this row is a copy of a known hash; the row's own ref when only the source knows the original. */
  readonly duplicateOf?: string;
  /** Set when the `file` move failed (UC1 ext. 5a); the row stays `inbox` and the next `scan` presents it again. */
  readonly error?: string;
}

/** What a source needs to act on a capture without hashing it again: its local name and its identity at scan time. */
export interface SourceTarget {
  readonly localName: string;
  /** Checked when size or time differ: a touched file with the same bytes is still the capture. */
  readonly contentHash: string;
  readonly size: number;
  readonly takenAt: string;
}

/** Name of every local copy: `<id>.<ext>` (glossary "Id"). */
export const localName = (row: Pick<CaptureRow, 'contentHash' | 'ext'>): string =>
  `${idOf(row.contentHash)}.${row.ext}`;

export const targetOf = (row: CaptureRow): SourceTarget => ({
  localName: localName(row),
  contentHash: row.contentHash,
  size: row.size,
  takenAt: row.takenAt,
});

/** A row a command may address: not final, not a duplicate (glossary "Id"). */
export const isAddressable = (row: CaptureRow): boolean =>
  row.status !== 'personal' && row.status !== 'deleted' && row.status !== 'duplicate';
