import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ScanReport } from '../src/commands/scan.js';
import { png, Workspace } from './helpers.js';

describe('CLI hardening', () => {
  let ws: Workspace;
  let id: string;
  beforeEach(async () => {
    ws = await Workspace.create();
    id = await ws.addCapture('a.png', png('one'));
  });
  afterEach(() => ws.dispose());

  it('an unknown flag is a usage error, exit 2', async () => {
    const run = await ws.run(['status', '--bogus']);

    expect(run.code).toBe(2);
    expect(run.err[0]).toContain('usage error');
  });

  it('an unexpected error exits 3 with a message and no stack', async () => {
    await ws.scan();
    await writeFile(join(ws.data, 'index.jsonl'), 'not json\n');

    const run = await ws.run(['status']);

    expect(run.code).toBe(3);
    expect(run.err.join('\n')).not.toContain('    at ');
  });

  it('refuses a --source that contains the data folder', async () => {
    const run = await ws.run(['scan', '--source', ws.root]);

    expect(run.code).toBe(2);
    expect(run.err[0]).toContain('--source must not contain');
  });

  it('scan --dry-run writes nothing and reports what it would do', async () => {
    const run = await ws.scan(['--dry-run']);

    expect(run.code).toBe(0);
    expect(run.json<ScanReport>().seen).toEqual({ inbox: 1 });
    expect(await ws.exists('data', 'index.jsonl')).toBe(false);
    expect(await ws.exists('data', 'inbox')).toBe(false);
  });

  it('file and doubt honour --dry-run', async () => {
    await ws.scan();

    const filed = await ws.run(['file', id, '--dry-run'], JSON.stringify({ promptVersion: 'v1', model: 'm', reasoning: 'r', domain: 'frontend', tags: [] }));
    const doubted = await ws.run(['doubt', id, '--dry-run'], JSON.stringify({ promptVersion: 'v1', model: 'm', reasoning: 'r', category: 'off-topic' }));

    expect(filed.code).toBe(0);
    expect(doubted.code).toBe(0);
    expect(filed.out.some((line) => line.startsWith('dry-run: move'))).toBe(true);
    expect((await ws.rowById(id))[0]?.status).toBe('inbox');
    expect(await ws.log()).toEqual([]);
  });

  it('a failed move keeps the row in the inbox with an error flag', async () => {
    await ws.scan();
    await ws.rewriteIndex((row) => ({ ...row, ext: 'jpg' }));

    const run = await ws.file(id, {});

    expect(run.code).toBe(3);
    expect((await ws.rowById(id))[0]).toMatchObject({ status: 'inbox', error: 'move failed' });
  });
});

describe('--source placement', () => {
  it('refuses a --source inside the data folder', async () => {
    const ws = await Workspace.create();
    const run = await ws.run(['scan', '--source', join(ws.data, 'inbox')]);
    await ws.dispose();

    expect(run.code).toBe(2);
  });
});
