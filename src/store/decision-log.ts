import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { sameDecision, type DecisionLine } from '../triage/decision.js';

/**
 * The versioned `knowledge/decisions.jsonl`: append-only, labels only (ADR-0002 decision 3).
 * The append is skipped only when the last line for the hash is identical, timestamp aside.
 */
export class DecisionLog {
  constructor(private readonly path: string) {}

  async lines(): Promise<readonly DecisionLine[]> {
    let text: string;
    try {
      text = await readFile(this.path, 'utf8');
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
    return text
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as DecisionLine);
  }

  /** Returns true when a line was written. */
  async append(line: DecisionLine): Promise<boolean> {
    const previous = (await this.lines()).filter((entry) => entry.contentHash === line.contentHash).at(-1);
    if (previous !== undefined && sameDecision(previous, line)) return false;
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, `${JSON.stringify(line)}\n`, 'utf8');
    return true;
  }
}

const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
