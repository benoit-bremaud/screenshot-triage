import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CaptureRow } from '../src/triage/capture.js';
import { transition } from '../src/triage/transition.js';
import { png, Workspace } from './helpers.js';

const doubtfulRow: CaptureRow = {
  ref: 'a.png',
  name: 'a.png',
  takenAt: '2026-11-01T00:00:00.000Z',
  contentHash: 'abcdef012345'.padEnd(64, '0'),
  ext: 'png',
  status: 'doubtful',
  category: 'off-topic',
  reasoning: 'Some text.',
};

describe('T-6 resolve personal / delete', () => {
  let ws: Workspace;
  let id: string;
  beforeEach(async () => {
    ws = await Workspace.create();
    id = await ws.addCapture('a.png', png('one'));
    await ws.addCapture('dup.png', png('one'));
    await ws.scan();
    await ws.doubt(id);
  });
  afterEach(() => ws.dispose());

  it('personal: local file deleted, source Personnel/<id>.<ext>, reasoning cleared, duplicate follows', async () => {
    const run = await ws.resolve(id, 'personal');
    expect(run.code).toBe(0);
    expect(await ws.exists('data', 'inbox', `${id}.png`)).toBe(false);
    expect(await ws.list('source', 'Personnel')).toEqual([`${id}.png`]);
    expect(await ws.list('source')).toEqual(['Personnel']);
    const rows = await ws.rowById(id);
    expect(rows.map((row) => row.status)).toEqual(['personal', 'personal']);
    expect(rows.some((row) => row.reasoning !== undefined)).toBe(false);
    expect(rows.find((row) => row.ref === 'a.png')?.doubtAnswer).toBe('personal');
  });

  it('delete: local file deleted, source .trash/<id>.<ext>, duplicate follows', async () => {
    await ws.resolve(id, 'delete');
    expect(await ws.exists('data', 'inbox', `${id}.png`)).toBe(false);
    expect(await ws.list('source', '.trash')).toEqual([`${id}.png`]);
    expect(await ws.list('source')).toEqual(['.trash']);
    expect((await ws.rowById(id)).map((row) => row.status)).toEqual(['deleted', 'deleted']);
  });

  it('pure transition: effect order is local delete, source call, index write, then each duplicate', () => {
    const dup: CaptureRow = { ...doubtfulRow, ref: 'b.png', status: 'duplicate', duplicateOf: 'a.png' };
    const result = transition(doubtfulRow, { type: 'resolve', answer: 'personal', duplicates: [dup] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.effects.map((effect) => effect.kind)).toEqual([
      'delete-local',
      'source-mark-personal',
      'index-write',
      'source-mark-personal',
      'index-write',
    ]);
  });
});

describe('T-7 --dry-run prints the effects in order and changes nothing', () => {
  let ws: Workspace;
  let id: string;
  beforeEach(async () => {
    ws = await Workspace.create();
    id = await ws.addCapture('a.png', png('one'));
    await ws.scan();
    await ws.doubt(id);
  });
  afterEach(() => ws.dispose());

  it('resolve --as delete --dry-run', async () => {
    const run = await ws.resolve(id, 'delete', ['--dry-run']);
    expect(run.code).toBe(0);
    expect(run.out.slice(0, 3)).toEqual([
      `dry-run: delete local ${id}.png`,
      `dry-run: source.trash(${id}.png)`,
      `dry-run: index: ${id} -> deleted`,
    ]);
    expect(await ws.exists('data', 'inbox', `${id}.png`)).toBe(true);
    expect((await ws.rowById(id))[0]?.status).toBe('doubtful');
    expect(await ws.list('source')).toEqual(['a.png']);
  });

  it('scan --dry-run on a new capture and on a returning personal copy', async () => {
    await ws.resolve(id, 'personal');
    await ws.addCapture('again.png', png('one'));
    const other = await ws.addCapture('new.png', png('two'));
    const run = await ws.scan(['--dry-run']);
    expect(run.out.slice(0, 4)).toEqual([
      `dry-run: source.markPersonal(${id}.png)`,
      `dry-run: index: ${id} -> personal`,
      `dry-run: copy source capture to data/inbox/${other}.png`,
      `dry-run: index: ${other} -> inbox`,
    ]);
    expect(await ws.list('source')).toEqual(['Personnel', 'again.png', 'new.png']);
    expect(await ws.exists('data', 'inbox', `${other}.png`)).toBe(false);
    expect((await ws.index()).map((row) => row.ref)).toEqual(['a.png']);
  });
});
