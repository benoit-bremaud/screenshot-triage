import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { png, Workspace } from './helpers.js';

const exec = promisify(execFile);

describe('CLI usage and the binary entry point', () => {
  let ws: Workspace;
  beforeEach(async () => {
    ws = await Workspace.create();
  });
  afterEach(() => ws.dispose());

  it('prints usage without a command (exit 2) and with --help (exit 0)', async () => {
    expect((await ws.run([])).code).toBe(2);
    const help = await ws.run(['--help']);
    expect(help.code).toBe(0);
    expect(help.out[0]).toContain('usage:');
  });

  it('rejects an unknown command, a missing --source, a bad --as', async () => {
    expect((await ws.run(['frobnicate'])).code).toBe(2);
    expect((await ws.run(['scan'])).code).toBe(2);
    const id = await ws.addCapture('a.png', png('one'));
    await ws.scan();
    await ws.doubt(id);
    expect((await ws.run(['resolve', id, '--as', 'maybe'])).code).toBe(2);
    expect((await ws.run(['resolve', id, '--as', 'delete'])).code).toBe(2);
    expect((await ws.resolve(id, 'delete', ['--dry-run'])).code).toBe(0);
  });

  it('runs as a process through the entry point: stdin payload, exit code', async () => {
    const id = await ws.addCapture('a.png', png('one'));
    await ws.scan();
    const common = ['--data', ws.data, '--knowledge', ws.knowledge];
    const { stdout } = await main(['tags', ...common]);
    expect(JSON.parse(stdout) as { domains: string[] }).toMatchObject({ domains: expect.any(Array) });
    await main(['doubt', id, ...common], JSON.stringify({ promptVersion: 'v', model: 'm', category: 'off-topic', reasoning: 'r' }));
    expect((await ws.rowById(id))[0]?.status).toBe('doubtful');
    await expect(main(['file', 'a.png', ...common], '{}')).rejects.toMatchObject({ code: 2 });
  }, 30_000);
});

/** Spawns `src/main.ts` through the tsx loader and always closes stdin. */
const main = (args: readonly string[], stdin = ''): Promise<{ stdout: string }> => {
  const child = exec(process.execPath, ['--import', 'tsx', 'src/main.ts', ...args]);
  child.child.stdin?.end(stdin);
  return child;
};
