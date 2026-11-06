import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runCli } from '../src/cli.js';
import type { CaptureRow } from '../src/triage/capture.js';
import type { DecisionLine } from '../src/triage/decision.js';

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52];

/** A distinct PNG-looking payload per seed; its id is the first 12 hex of the SHA-256. */
export const png = (seed: string): Uint8Array => Uint8Array.from([...PNG_HEADER, ...Buffer.from(seed, 'utf8')]);

export const jpg = (seed: string): Uint8Array =>
  Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, ...Buffer.from(seed, 'utf8')]);

export const idOfBytes = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex').slice(0, 12);

export interface Run {
  readonly code: number;
  readonly out: string[];
  readonly err: string[];
  readonly json: <T>() => T;
}

export class Workspace {
  private constructor(
    readonly root: string,
    readonly source: string,
    readonly data: string,
    readonly knowledge: string,
  ) {}

  now: Date = new Date('2026-11-06T12:00:00Z');

  static async create(): Promise<Workspace> {
    const root = await mkdtemp(join(tmpdir(), 'screenshot-triage-'));
    const ws = new Workspace(root, join(root, 'source'), join(root, 'data'), join(root, 'knowledge'));
    await mkdir(ws.source, { recursive: true });
    return ws;
  }

  async dispose(): Promise<void> {
    await rm(this.root, { recursive: true, force: true });
  }

  async addCapture(name: string, bytes: Uint8Array, takenAt?: Date): Promise<string> {
    const path = join(this.source, name);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, bytes);
    if (takenAt !== undefined) await utimes(path, takenAt, takenAt);
    return idOfBytes(bytes);
  }

  async run(args: readonly string[], stdin = ''): Promise<Run> {
    const out: string[] = [];
    const err: string[] = [];
    const code = await runCli([...args, '--data', this.data, '--knowledge', this.knowledge], {
      stdin,
      out: (line) => out.push(line),
      err: (line) => err.push(line),
      now: () => this.now,
    });
    return { code, out, err, json: <T>() => JSON.parse(out.at(-1) ?? 'null') as T };
  }

  scan(extra: readonly string[] = []): Promise<Run> {
    return this.run(['scan', '--source', this.source, ...extra]);
  }

  file(id: string, payload: Record<string, unknown>): Promise<Run> {
    return this.run(['file', id], JSON.stringify({ ...fileDecision, ...payload }));
  }

  doubt(id: string, payload: Record<string, unknown> = {}): Promise<Run> {
    return this.run(['doubt', id], JSON.stringify({ ...doubtDecision, ...payload }));
  }

  resolve(id: string, answer: string, extra: readonly string[] = []): Promise<Run> {
    return this.run(['resolve', id, '--as', answer, '--source', this.source, ...extra]);
  }

  async index(): Promise<CaptureRow[]> {
    return readJsonl<CaptureRow>(join(this.data, 'index.jsonl'));
  }

  async rowById(id: string): Promise<CaptureRow[]> {
    return (await this.index()).filter((row) => row.contentHash.startsWith(id));
  }

  async log(): Promise<DecisionLine[]> {
    return readJsonl<DecisionLine>(join(this.knowledge, 'decisions.jsonl'));
  }

  async logText(): Promise<string> {
    return readFile(join(this.knowledge, 'decisions.jsonl'), 'utf8').catch(() => '');
  }

  async exists(...parts: string[]): Promise<boolean> {
    return stat(join(this.root, ...parts)).then(
      () => true,
      () => false,
    );
  }

  async list(...parts: string[]): Promise<string[]> {
    return readdir(join(this.root, ...parts)).catch(() => []);
  }

  /** Simulates a crash between two effects by rewriting the index rows. */
  async rewriteIndex(edit: (row: CaptureRow) => CaptureRow): Promise<void> {
    const rows = (await this.index()).map(edit);
    await writeFile(join(this.data, 'index.jsonl'), rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  }

  async removeIndex(): Promise<void> {
    await rm(join(this.data, 'index.jsonl'), { force: true });
  }
}

const readJsonl = async <T>(path: string): Promise<T[]> => {
  const text = await readFile(path, 'utf8').catch(() => '');
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as T);
};

export const fileDecision = {
  promptVersion: 'triage-v1',
  model: 'claude-sonnet-5-5',
  domain: 'frontend',
  tags: ['react', 'hooks'],
  consideredTags: ['react-hooks'],
  confidence: 0.9,
  reasoning: 'A code snippet about a React hook with its explanation.',
};

export const doubtDecision = {
  promptVersion: 'triage-v1',
  model: 'claude-sonnet-5-5',
  category: 'personal-suspected',
  reasoning: 'A chat conversation with a first name, no dev or design content.',
};
