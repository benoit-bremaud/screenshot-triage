import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extractRun, png, triagedCapture, Workspace } from './helpers.js';

describe('UC5 purge (T-19)', () => {
  let ws: Workspace;
  beforeEach(async () => {
    ws = await Workspace.create();
  });
  afterEach(() => ws.dispose());

  const setup = async (): Promise<{ id: string; kept: string }> => {
    const id = await triagedCapture(ws, 'a.png', png('a'));
    await ws.addCapture('copy/a.png', png('a'));
    const kept = await triagedCapture(ws, 'k.png', png('k'));
    await ws.scan();
    await extractRun(ws, id);
    return { id, kept };
  };

  it('deletes and trashes every extracted capture and its duplicates, touches no other status', async () => {
    const { id, kept } = await setup();

    const run = await ws.run(['purge', '--source', ws.source]);

    expect(run.code).toBe(0);
    expect(run.json()).toEqual({ purged: 1, failed: [], dryRun: false });
    expect((await ws.rowById(id)).map((row) => row.status)).toEqual(['deleted', 'deleted']);
    expect((await ws.rowById(kept))[0]?.status).toBe('triaged');
    expect(await ws.list('data', 'frontend')).toEqual([`${kept}.png`]);
    expect((await ws.list('source', '.trash')).sort()).toEqual([`${id}.png`]);
    expect(await ws.list('source', 'copy')).toEqual([]);
    expect(await ws.exists('knowledge', 'frontend', `${id}.md`)).toBe(true);
  });

  it('--dry-run prints duplicates first and changes nothing', async () => {
    const { id } = await setup();

    const run = await ws.run(['purge', '--source', ws.source, '--dry-run']);

    expect(run.out.filter((line) => line.startsWith('dry-run:'))).toEqual([
      `dry-run: source.trash(${id}.png)`,
      `dry-run: index: ${id} -> deleted`,
      `dry-run: delete local ${id}.png`,
      `dry-run: source.trash(${id}.png)`,
      `dry-run: index: ${id} -> deleted`,
    ]);
    expect((await ws.rowById(id)).map((row) => row.status).sort()).toEqual(['duplicate', 'extracted']);
    expect(await ws.exists('source', 'a.png')).toBe(true);
  });

  it('a re-run after a crash between a duplicate and its original completes', async () => {
    const { id } = await setup();
    await ws.run(['purge', '--source', ws.source]);
    // Crash simulation: the original's row was never written, its local file and source asset are gone.
    await ws.rewriteIndex((row) => (row.ref === 'a.png' ? { ...row, status: 'extracted' } : row));

    const run = await ws.run(['purge', '--source', ws.source]);

    expect(run.json()).toEqual({ purged: 1, failed: [], dryRun: false });
    expect((await ws.rowById(id)).map((row) => row.status)).toEqual(['deleted', 'deleted']);
  });

  it('needs --source', async () => {
    await setup();

    expect((await ws.run(['purge'])).code).toBe(2);
  });
});
