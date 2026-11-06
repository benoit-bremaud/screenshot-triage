import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { idOf, isAddressable, type CaptureRow } from '../triage/capture.js';

/**
 * The private index `data/index.jsonl`, one row per ref (ADR-0002 decision 2).
 * Loaded whole, rewritten whole: a few hundred rows at most.
 */
export class CaptureIndex {
  private readonly rows = new Map<string, CaptureRow>();

  private constructor(private readonly path: string) {}

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

  duplicatesOf(ref: string): readonly CaptureRow[] {
    return this.all().filter((row) => row.duplicateOf === ref && row.status === 'duplicate');
  }

  async upsert(row: CaptureRow): Promise<void> {
    this.rows.set(row.ref, row);
    await mkdir(dirname(this.path), { recursive: true });
    const lines = this.all().map((entry) => JSON.stringify(entry));
    await writeFile(this.path, lines.length === 0 ? '' : `${lines.join('\n')}\n`, 'utf8');
  }
}

const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
