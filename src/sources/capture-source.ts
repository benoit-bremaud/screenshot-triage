import type { SourceTarget } from '../triage/capture.js';

/** A capture as the source lists it; `ref` is the only name the source knows (glossary "Ref"). */
export interface SourceCapture {
  /** Relative, `/`-separated path on a local directory; the asset id on Immich. */
  readonly ref: string;
  readonly name: string;
  /** ISO 8601. */
  readonly takenAt: string;
  /** Byte length, checked again before any source action. */
  readonly size: number;
  readonly ocrText?: string;
}

/** Ids the source holds as final: `Personnel/` and `.trash/` membership, content never read. */
export interface FinalIds {
  readonly personal: ReadonlySet<string>;
  readonly trashed: ReadonlySet<string>;
}

/**
 * The CaptureSource port of `03-component.md`. The source is the durable record of final
 * statuses (ADR-0002): `markPersonal` and `trash` are real on every implementation.
 */
export interface CaptureSource {
  /** Every capture outside the final folders; symbolic links are skipped. */
  listCaptures(): Promise<readonly SourceCapture[]>;
  /** Bytes of one capture; throws on a ref outside the source. */
  read(ref: string): Promise<Uint8Array>;
  /**
   * Files the capture as personal under `target.localName`. A ref already gone is a no-op. A file whose
   * size or time differ from `target` is hashed (never interpreted) and left alone unless its bytes are
   * the scanned ones. A duplicate whose target name already exists is removed instead, after a size check of that record (its bytes are never read).
   */
  markPersonal(ref: string, target: SourceTarget): Promise<void>;
  /** Same contract as `markPersonal`, into the trash. */
  trash(ref: string, target: SourceTarget): Promise<void>;
  /** Ids only, from `Personnel/` and `.trash/` membership: the two first `scan` guards read this (REQ-5). */
  finalIds(): Promise<FinalIds>;
}
