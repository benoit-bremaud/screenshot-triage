import { chmod, mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extractRun, png, triagedCapture, Workspace } from './helpers.js';

describe('UC5 purge (T-19)', () => {
  let ws: Workspace;
  beforeEach(async () => {
    ws = await Workspace.create();
  });
  afterEach(async () => {
    await chmod(ws.source, 0o755).catch(() => undefined);
    await ws.dispose();
  });

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
    expect(run.json()).toEqual({ purged: 1, failed: [], skipped: [], dryRun: false });
    expect((await ws.rowById(id)).map((row) => row.status)).toEqual(['deleted', 'deleted']);
    expect((await ws.rowById(kept))[0]?.status).toBe('triaged');
    expect(await ws.list('data', 'frontend')).toEqual([`${kept}.png`]);
    expect(await ws.list('source', '.trash')).toEqual([`${id}.png`]);
    expect(await ws.exists('source', 'a.png')).toBe(false);
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
    // Crash after the duplicate's source.trash, before its row: the copy sits in .trash/, both rows unchanged.
    await mkdir(join(ws.source, '.trash'), { recursive: true });
    await rename(join(ws.source, 'copy', 'a.png'), join(ws.source, '.trash', `${id}.png`));

    const run = await ws.run(['purge', '--source', ws.source]);

    expect(run.json()).toMatchObject({ purged: 1, failed: [] });
    expect((await ws.rowById(id)).map((row) => row.status)).toEqual(['deleted', 'deleted']);
    expect(await ws.exists('source', 'a.png')).toBe(false);
    expect(await ws.list('data', 'frontend')).not.toContain(`${id}.png`);
  });

  it('skips a capture whose sheet is missing: no deletion without a sheet', async () => {
    const { id } = await setup();
    await rm(join(ws.knowledge, 'frontend', `${id}.md`));

    const run = await ws.run(['purge', '--source', ws.source]);

    expect(run.json()).toEqual({ purged: 0, failed: [], skipped: [id], dryRun: false });
    expect((await ws.rowById(id)).map((row) => row.status).sort()).toEqual(['duplicate', 'extracted']);
    expect(await ws.exists('source', 'a.png')).toBe(true);
  });

  // A read-only folder does not stop root, so the failure cannot be provoked that way.
  it.skipIf(process.getuid?.() === 0)('a failed source call is reported, exit 3, the row stays extracted with an error, a re-run completes', async () => {
    const { id } = await setup();
    await chmod(ws.source, 0o555);

    const failed = await ws.run(['purge', '--source', ws.source]);

    expect(failed.code).toBe(3);
    expect(failed.json()).toMatchObject({ purged: 0, failed: [id] });
    expect((await ws.rowById(id)).find((row) => row.ref === 'a.png')).toMatchObject({ status: 'extracted', error: 'purge failed' });

    await chmod(ws.source, 0o755);
    const rerun = await ws.run(['purge', '--source', ws.source]);
    expect(rerun.code).toBe(0);
    const original = (await ws.rowById(id)).find((row) => row.ref === 'a.png');
    expect(original?.status).toBe('deleted');
    expect(original?.error).toBeUndefined();
  });

  it('needs --source', async () => {
    await setup();

    expect((await ws.run(['purge'])).code).toBe(2);
  });
});
