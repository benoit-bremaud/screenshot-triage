import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ScanReport } from '../src/commands/scan.js';
import { png, Workspace } from './helpers.js';

describe('T-2 scan: a known hash whose original is not final becomes a duplicate', () => {
  let ws: Workspace;
  beforeEach(async () => {
    ws = await Workspace.create();
  });
  afterEach(() => ws.dispose());

  it('writes a duplicate row pointing at the original and copies nothing', async () => {
    const id = await ws.addCapture('a.png', png('same'));
    await ws.scan();
    await ws.addCapture('copy/b.png', png('same'));
    const run = await ws.scan();
    expect(run.json<ScanReport>().seen).toEqual({ duplicate: 1 });
    const rows = await ws.rowById(id);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.ref === 'copy/b.png')).toMatchObject({ status: 'duplicate', duplicateOf: 'a.png' });
    expect(await ws.list('data', 'inbox')).toEqual([`${id}.png`]);
    expect(run.json<ScanReport>().inbox).toHaveLength(1);
  });

  it('a duplicate of a triaged capture is still a duplicate', async () => {
    const id = await ws.addCapture('a.png', png('same'));
    await ws.scan();
    await ws.file(id, {});
    await ws.addCapture('b.png', png('same'));
    const run = await ws.scan();
    expect(run.json<ScanReport>().seen).toEqual({ duplicate: 1 });
  });
});
