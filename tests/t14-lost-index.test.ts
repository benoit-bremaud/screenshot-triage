import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ScanReport } from '../src/commands/scan.js';
import { png, Workspace } from './helpers.js';

describe('T-14 the source is the durable record of final statuses', () => {
  let ws: Workspace;
  let personalId: string;
  let deletedId: string;
  let workId: string;
  beforeEach(async () => {
    ws = await Workspace.create();
    personalId = await ws.addCapture('p.png', png('personal'));
    await ws.addCapture('p-dup.png', png('personal'));
    deletedId = await ws.addCapture('d.png', png('deleted'));
    workId = await ws.addCapture('w.png', png('work'));
    await ws.scan();
    await ws.doubt(personalId);
    await ws.resolve(personalId, 'personal');
    await ws.doubt(deletedId);
    await ws.resolve(deletedId, 'delete');
  });
  afterEach(() => ws.dispose());

  it('a fresh scan after losing the index lists work captures only; duplicates carry the final status', async () => {
    expect((await ws.rowById(personalId)).map((row) => row.status)).toEqual(['personal', 'personal']);
    await ws.removeIndex();
    const run = await ws.scan();
    const report = run.json<ScanReport>();
    expect(report.inbox.map((item) => item.id)).toEqual([workId]);
    expect(await ws.list('source')).toEqual(['.trash', 'Personnel', 'w.png']);
  });

  it('a copy re-synced after the index was lost takes the Personal branch, never the Inbox one', async () => {
    await ws.removeIndex();
    await ws.addCapture('resync.png', png('personal'));
    const run = await ws.scan();
    expect(run.json<ScanReport>().seen).toEqual({ inbox: 1, personal: 1 });
    expect(await ws.list('source', 'Personnel')).toEqual([`${personalId}.png`]);
    expect(await ws.exists('source', 'resync.png')).toBe(false);
    expect(await ws.exists('data', 'inbox', `${personalId}.png`)).toBe(false);
    expect((await ws.rowById(personalId))[0]).toMatchObject({ status: 'personal', ref: 'resync.png' });
  });

  it('a copy of a deleted capture is re-trashed while its id is still in .trash/', async () => {
    await ws.addCapture('resync-d.png', png('deleted'));
    const run = await ws.scan();
    expect(run.json<ScanReport>().seen).toEqual({ deleted: 1 });
    expect(await ws.exists('source', 'resync-d.png')).toBe(false);
    expect((await ws.rowById(deletedId)).find((row) => row.ref === 'resync-d.png')).toMatchObject({
      status: 'deleted',
      duplicateOf: 'd.png',
    });
  });

  it('a file the owner restored from .trash/ is triaged again as new', async () => {
    const { rename } = await import('node:fs/promises');
    await rename(`${ws.source}/.trash/${deletedId}.png`, `${ws.source}/back.png`);
    const run = await ws.scan();
    expect(run.json<ScanReport>().seen).toEqual({ inbox: 1 });
    expect(await ws.exists('data', 'inbox', `${deletedId}.png`)).toBe(true);
  });

  it('Personnel/ content is never read: only names are listed', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(`${ws.source}/Personnel/not-an-image.txt`, 'private text');
    const run = await ws.scan();
    expect(run.code).toBe(0);
    expect(run.json<ScanReport>().rejected).toBe(0);
  });
});
