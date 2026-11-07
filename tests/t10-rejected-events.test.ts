import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { png, Workspace } from './helpers.js';

describe('T-10 illegal transitions are rejected with the current status and exit 1 (REQ-8)', () => {
  let ws: Workspace;
  let id: string;
  beforeEach(async () => {
    ws = await Workspace.create();
    id = await ws.addCapture('a.png', png('one'));
    await ws.scan();
  });
  afterEach(() => ws.dispose());

  it('resolve on an inbox capture', async () => {
    const run = await ws.resolve(id, 'delete');
    expect(run.code).toBe(1);
    expect(run.err[0]).toContain('current status: inbox');
    expect(await ws.list('source')).toEqual(['a.png']);
  });

  it('file on a doubtful capture', async () => {
    await ws.doubt(id);
    const run = await ws.file(id, {});
    expect(run.code).toBe(1);
    expect(run.err[0]).toContain('current status: doubtful');
  });

  it('doubt on a triaged capture', async () => {
    await ws.file(id, {});
    const run = await ws.doubt(id);
    expect(run.code).toBe(1);
    expect(run.err[0]).toContain('current status: triaged');
  });

  it('doubt on an inbox capture the owner kept as work', async () => {
    await ws.doubt(id);
    await ws.resolve(id, 'work');
    const run = await ws.doubt(id);
    expect(run.code).toBe(1);
    expect(run.err[0]).toContain('already kept');
  });

  it('file on a deleted capture is rejected with its current status', async () => {
    await ws.doubt(id);
    await ws.resolve(id, 'delete');
    const run = await ws.file(id, {});
    expect(run.code).toBe(1);
    expect(run.err[0]).toContain('current status: deleted');
  });

  it('file with a duplicate id addresses the original, never the duplicate row', async () => {
    const dupId = await ws.addCapture('b.png', png('one'));
    await ws.scan();
    expect(dupId).toBe(id);
    await ws.file(id, {});
    expect((await ws.rowById(id)).find((row) => row.ref === 'b.png')?.status).toBe('duplicate');
  });

  it('resolve on a duplicate-only id', async () => {
    await ws.doubt(id);
    await ws.resolve(id, 'personal');
    const run = await ws.resolve(id, 'personal');
    expect(run.code).toBe(1);
  });
});
