import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ScanReport } from '../src/commands/scan.js';
import { runCli } from '../src/cli.js';
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

describe('source root pinned in data/source.json', () => {
  let ws: Workspace;
  let id: string;
  beforeEach(async () => {
    ws = await Workspace.create();
    id = await ws.addCapture('a.png', png('one'));
    await ws.scan();
    await ws.doubt(id);
  });
  afterEach(() => ws.dispose());

  it('a capture deleted on the phone is still resolved (A)', async () => {
    await rm(join(ws.source, 'a.png'));

    const run = await ws.resolve(id, 'delete');

    expect(run.code).toBe(0);
    expect((await ws.rowById(id))[0]?.status).toBe('deleted');
  });

  it('a duplicate is still marked when the original is gone (H)', async () => {
    await ws.addCapture('b.png', png('one'));
    await ws.scan();
    await rm(join(ws.source, 'a.png'));

    const run = await ws.resolve(id, 'personal');

    expect(run.code).toBe(0);
    expect(await ws.list('source', 'Personnel')).toEqual([`${id}.png`]);
    expect(await ws.exists('source', 'b.png')).toBe(false);
  });

  it('another --source is refused before any effect (B)', async () => {
    const other = join(ws.root, 'other');
    await mkdir(other);
    await writeFile(join(other, 'a.png'), 'unrelated');

    const run = await ws.run(['resolve', id, '--as', 'delete', '--source', other]);

    expect(run.code).toBe(2);
    expect(await ws.exists('data', 'inbox', `${id}.png`)).toBe(true);
    expect((await ws.rowById(id))[0]?.status).toBe('doubtful');
  });
});

describe('Codex review on PR #9', () => {
  let ws: Workspace;
  beforeEach(async () => {
    ws = await Workspace.create();
  });
  afterEach(() => ws.dispose());

  it('an extra positional argument is a usage error', async () => {
    const id = await ws.addCapture('a.png', png('one'));

    const run = await ws.run(['resolve', id, 'extra', '--as', 'delete', '--source', ws.source]);

    expect(run.code).toBe(2);
    expect(run.err[0]).toContain('unexpected argument');
  });

  it.each([['status', 'extra'], ['tags', 'abcdef012345'], ['scan', 'x']])('%s refuses a positional argument', async (...args) => {
    const run = await ws.run(args[0] === 'scan' ? [...args, '--source', ws.source] : args);

    expect(run.code).toBe(2);
  });

  it('a --source that reaches the data folder through a symbolic link is refused', async () => {
    await mkdir(ws.data, { recursive: true });
    const link = join(ws.root, 'link');
    await symlink(ws.data, link);

    const run = await ws.run(['scan', '--source', link]);

    expect(run.code).toBe(2);
    expect(run.err[0]).toContain('--source must not contain');
  });
});

describe('Codex review on PR #9, second pass', () => {
  let ws: Workspace;
  beforeEach(async () => {
    ws = await Workspace.create();
  });
  afterEach(() => ws.dispose());

  it('refuses a data folder inside the knowledge folder', async () => {
    const run = await runIn(ws, ['status', '--data', join(ws.knowledge, 'private')]);

    expect(run.code).toBe(2);
    expect(run.err[0]).toContain('--data and --knowledge');
  });

  it.each([
    ['frobnicate', '--source'],
    ['resolve', 'abcdef012345', '--as', 'maybe', '--source'],
  ])('an invalid %s invocation never pins the source', async (...args) => {
    const run = await ws.run([...args, ws.source]);

    expect(run.code).toBe(2);
    expect(await ws.exists('data', 'source.json')).toBe(false);
  });

  it('refuses a regular file as --source and pins nothing', async () => {
    const file = join(ws.root, 'not-a-dir.png');
    await writeFile(file, 'x');

    const run = await ws.run(['scan', '--source', file]);

    expect(run.code).toBe(2);
    expect(await ws.exists('data', 'source.json')).toBe(false);
  });
});

/** Runs the CLI with an explicit --data, bypassing the workspace default. */
const runIn = async (ws: Workspace, args: readonly string[]) => {
  const err: string[] = [];
  const code = await runCli([...args, '--knowledge', ws.knowledge], {
    readStdin: () => Promise.resolve(''),
    out: () => undefined,
    err: (line) => err.push(line),
  });
  return { code, err };
};
