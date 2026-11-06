import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { StatusReport } from '../src/commands/status.js';
import { png, Workspace } from './helpers.js';

describe('UC3 status (T-9, T-13)', () => {
  let ws: Workspace;
  beforeEach(async () => {
    ws = await Workspace.create();
  });
  afterEach(() => ws.dispose());

  it('T-9: lists the other captures older than 90 days, not the recent ones', async () => {
    const old = await ws.addCapture('old.png', png('old'), new Date('2026-06-01T00:00:00Z'));
    const recent = await ws.addCapture('recent.png', png('recent'), new Date('2026-10-01T00:00:00Z'));
    await ws.scan();
    await ws.file(old, { domain: 'other' });
    await ws.file(recent, { domain: 'other' });
    const report = (await ws.run(['status', '--json'])).json<StatusReport>();
    expect(report.oldOther).toEqual([{ id: old, takenAt: '2026-06-01T00:00:00.000Z' }]);
  });

  it('T-13: counts per status and domain, doubtful list, tag counts with new-skill candidates', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) ids.push(await ws.addCapture(`c${String(i)}.png`, png(`c${String(i)}`)));
    const doubtfulId = await ws.addCapture('d.png', png('doubt'));
    await ws.scan();
    for (const id of ids) await ws.file(id, { tags: ['tailwind'], consideredTags: [] });
    await ws.doubt(doubtfulId, { category: 'unreadable' });
    const run = await ws.run(['status', '--json']);
    const report = run.json<StatusReport>();
    expect(report.byStatus).toEqual({ triaged: 5, doubtful: 1 });
    expect(report.byDomain).toEqual({ frontend: 5 });
    expect(report.doubtful).toEqual([
      { id: doubtfulId, path: expect.stringContaining(`inbox/${doubtfulId}.png`), category: 'unreadable', reasoning: expect.any(String) },
    ]);
    expect(report.tags).toEqual([{ tag: 'tailwind', count: 5, newSkillCandidate: true }]);
    const text = await ws.run(['status']);
    expect(text.out.join('\n')).toContain('tailwind 5 (new-skill candidate)');
    expect(text.out.join('\n')).toContain('doubtful: 1 awaiting an answer');
  });

  it('status on an empty index', async () => {
    const run = await ws.run(['status']);
    expect(run.code).toBe(0);
    expect(run.out[0]).toBe('statuses: none');
  });
});
