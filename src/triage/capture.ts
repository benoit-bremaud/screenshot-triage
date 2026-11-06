import type { Domain } from './domains.js';
import type { ImageExt } from './image.js';
import type { Answer, DoubtCategory, Status } from './status.js';

/** The id is the first 12 hex characters of the content hash: the only identifier on argv (REQ-9). */
export const CAPTURE_ID = /^[0-9a-f]{12}$/;

export const isCaptureId = (value: string): boolean => CAPTURE_ID.test(value);

export const idOf = (contentHash: string): string => contentHash.slice(0, 12);

/** One row of the private index `data/index.jsonl`, keyed by ref (ADR-0002 decision 2). */
export interface CaptureRow {
  readonly ref: string;
  readonly name: string;
  readonly takenAt: string;
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
  /** Ref of the original when this row is a copy of a known hash. */
  readonly duplicateOf?: string;
  readonly error?: string;
}

/** Name of every local copy: `<id>.<ext>` (glossary "Id"). */
export const localName = (row: Pick<CaptureRow, 'contentHash' | 'ext'>): string =>
  `${idOf(row.contentHash)}.${row.ext}`;

/** A row a command may address: not final, not a duplicate (glossary "Id"). */
export const isAddressable = (row: CaptureRow): boolean =>
  row.status !== 'personal' && row.status !== 'deleted' && row.status !== 'duplicate';
