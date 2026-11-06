/** A capture as the source lists it; `ref` is the only name the source knows (glossary "Ref"). */
export interface SourceCapture {
  readonly ref: string;
  readonly name: string;
  readonly takenAt: string;
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
  listCaptures(): Promise<readonly SourceCapture[]>;
  read(ref: string): Promise<Uint8Array>;
  /** Marks the capture personal under its `<id>.<ext>` name; never reads it again. */
  markPersonal(ref: string, localName: string): Promise<void>;
  trash(ref: string, localName: string): Promise<void>;
  finalIds(): Promise<FinalIds>;
}
