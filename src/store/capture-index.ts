import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { isMissing } from '../fs.js';
import { idOf, isAddressable, type CaptureRow } from '../triage/capture.js';
import type { Status } from '../triage/status.js';

/**
 * The private index `data/index.jsonl`, one row per ref (ADR-0002 decision 2).
 * Loaded whole, rewritten whole through a temporary file: a few hundred rows at most.
 */
export class CaptureIndex {
  private readonly rows = new Map<string, CaptureRow>();

  private constructor(private readonly path: string) {}

  /** A missing file is an empty index; a malformed line throws. */
  static async load(path: string): Promise<CaptureIndex> {
    const index = new CaptureIndex(path);
    let text: string;
    try {
      text = await readFile(path, 'utf8');
    } catch (error) {
      if (isMissing(error)) return index;
      throw error;
    }
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue;
      const row = JSON.parse(line) as CaptureRow;
      index.rows.set(row.ref, row);
    }
    return index;
  }

  all(): readonly CaptureRow[] {
    return [...this.rows.values()];
  }

  byRef(ref: string): CaptureRow | undefined {
    return this.rows.get(ref);
  }

  byHash(contentHash: string): readonly CaptureRow[] {
    return this.all().filter((row) => row.contentHash === contentHash);
  }

  /** The one addressable row for an id (glossary "Id"). */
  byId(id: string): CaptureRow | undefined {
    return this.all().find((row) => idOf(row.contentHash) === id && isAddressable(row));
  }

  /**
   * The row a command on an id acts on: the addressable one, else the archived original (its copies point at it,
   * ADR-0004), else the last row carrying the id, for reporting its status.
   */
  forCommand(id: string): CaptureRow | undefined {
    const archived = this.all().find(
      (row) => idOf(row.contentHash) === id && row.status === 'archived' && (row.duplicateOf ?? row.ref) === row.ref,
    );
    return this.byId(id) ?? archived ?? this.latestById(id);
  }

  /** The last row carrying an id, addressable or not: for reporting the current status of a rejected command. */
  latestById(id: string): CaptureRow | undefined {
    return [...this.all()].reverse().find((row) => idOf(row.contentHash) === id);
  }

  duplicatesOf(ref: string, status: Status = 'duplicate'): readonly CaptureRow[] {
    return this.all().filter((row) => row.duplicateOf === ref && row.ref !== ref && row.status === status);
  }

  /** Records the row in memory only: what `--dry-run` sees of its own earlier effects. */
  stage(row: CaptureRow): void {
    this.rows.set(row.ref, row);
  }

  async upsert(row: CaptureRow): Promise<void> {
    this.stage(row);
    await mkdir(dirname(this.path), { recursive: true });
    const lines = this.all().map((entry) => JSON.stringify(entry));
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, lines.length === 0 ? '' : `${lines.join('\n')}\n`, 'utf8');
    await rename(tmp, this.path);
  }
}
