import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { StatusReport } from '../src/commands/status.js';
import { png, triagedCapture, Workspace } from './helpers.js';

describe('triaged captures: resolve (T-22) and status (T-23)', () => {
  let ws: Workspace;
  beforeEach(async () => {
    ws = await Workspace.create();
  });
  afterEach(() => ws.dispose());

  it('T-22: resolve personal on a triaged capture and its duplicate', async () => {
    const id = await triagedCapture(ws, 'a.png', png('a'));
    await ws.addCapture('copy/a.png', png('a'));
    await ws.scan();

    const run = await ws.resolve(id, 'personal');

    expect(run.code).toBe(0);
    const rows = await ws.rowById(id);
    expect(rows.map((row) => row.status)).toEqual(['personal', 'personal']);
    expect(rows.every((row) => row.reasoning === undefined)).toBe(true);
    expect(await ws.list('data', 'frontend')).toEqual([]);
    expect(await ws.list('source', 'Personnel')).toEqual([`${id}.png`]);
    expect(await ws.log()).toHaveLength(1);
  });

  it('T-22: resolve delete on a triaged capture; work is rejected', async () => {
    const id = await triagedCapture(ws, 'a.png', png('a'));

    expect((await ws.resolve(id, 'work')).code).toBe(1);
    expect((await ws.resolve(id, 'delete')).code).toBe(0);
    expect((await ws.rowById(id))[0]?.status).toBe('deleted');
    expect(await ws.list('source', '.trash')).toEqual([`${id}.png`]);
  });

  it('T-23: status lists the triaged captures with path, domain and tags', async () => {
    const id = await triagedCapture(ws, 'a.png', png('a'), 'design');

    const json = (await ws.run(['status', '--json'])).json<StatusReport>();
    const text = await ws.run(['status']);

    expect(json.triaged).toEqual([
      { id, path: expect.stringContaining(`design/${id}.png`), domain: 'design', tags: ['react', 'hooks'] },
    ]);
    expect(text.out).toContain('triaged: 1 to extract');
  });
});
