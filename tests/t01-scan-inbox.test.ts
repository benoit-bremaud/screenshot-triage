import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ScanReport } from '../src/commands/scan.js';
import { png, Workspace } from './helpers.js';

describe('T-1 scan: a new capture enters the inbox', () => {
  let ws: Workspace;
  beforeEach(async () => {
    ws = await Workspace.create();
  });
  afterEach(() => ws.dispose());

  it('copies the capture as <id>.<ext> and writes an inbox row with its hash', async () => {
    const id = await ws.addCapture('IMG_001.PNG', png('one'));
    const run = await ws.scan();
    expect(run.code).toBe(0);
    expect(await ws.exists('data', 'inbox', `${id}.png`)).toBe(true);
    const [row] = await ws.index();
    expect(row).toMatchObject({ ref: 'IMG_001.PNG', status: 'inbox', ext: 'png' });
    expect(row?.contentHash.startsWith(id)).toBe(true);
    const report = run.json<ScanReport>();
    expect(report.inbox).toEqual([{ id, path: expect.stringContaining(`inbox/${id}.png`) }]);
    expect(report.seen).toEqual({ inbox: 1 });
  });

  it('does not touch a capture already indexed, and lists the inbox again', async () => {
    await ws.addCapture('a.png', png('one'));
    await ws.scan();
    const second = await ws.scan();
    expect(second.json<ScanReport>().seen).toEqual({});
    expect(second.json<ScanReport>().inbox).toHaveLength(1);
  });

  it('triages a file restored from .trash again as new, under its new ref', async () => {
    const id = await ws.addCapture('a.png', png('one'));
    await ws.scan();
    await ws.doubt(id);
    await ws.resolve(id, 'delete');
    expect(await ws.list('source', '.trash')).toEqual([`${id}.png`]);
    await ws.addCapture('restored.png', png('one'));
    const { rm } = await import('node:fs/promises');
    await rm(`${ws.source}/.trash/${id}.png`);
    const run = await ws.scan();
    expect(run.json<ScanReport>().seen).toEqual({ inbox: 1 });
    const rows = await ws.rowById(id);
    expect(rows.map((row) => row.status).sort()).toEqual(['deleted', 'inbox']);
  });
});
