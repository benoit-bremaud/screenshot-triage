import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { StatusReport } from '../src/commands/status.js';
import { png, Workspace } from './helpers.js';

describe('UC3 status (T-13)', () => {
  let ws: Workspace;
  beforeEach(async () => {
    ws = await Workspace.create();
  });
  afterEach(() => ws.dispose());

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
      { id: doubtfulId, path: expect.stringContaining(`inbox/${doubtfulId}.png`), category: 'unreadable' },
    ]);
    expect(report.tags).toEqual([{ tag: 'tailwind', count: 5, newSkillCandidate: true }]);
    const text = await ws.run(['status']);
    expect(text.out.join('\n')).toContain('tailwind 5 (new-skill candidate)');
    expect(text.out.join('\n')).toContain('doubtful: 1 awaiting an answer');
  });

  it('T-13: a doubtful capture is listed without its OCR text or the model reasoning (#27)', async () => {
    const id = await ws.addCapture('p.png', png('private'));
    await ws.scan();
    await ws.doubt(id, { category: 'personal-suspected', reasoning: 'SECRET-REASONING' });
    // The local source has no OCR; an OCR-capable source (Immich, #3) fills the row like this.
    await ws.rewriteIndex((row) => ({ ...row, ocrText: 'SECRET-OCR' }));
    const json = await ws.run(['status', '--json']);
    expect(json.json<StatusReport>().doubtful).toEqual([
      { id, path: expect.stringContaining(`inbox/${id}.png`), category: 'personal-suspected' },
    ]);
    const text = await ws.run(['status']);
    for (const output of [json.out.join('\n'), text.out.join('\n')]) {
      expect(output).not.toContain('SECRET-OCR');
      expect(output).not.toContain('SECRET-REASONING');
    }
  });

  it('status on an empty index', async () => {
    const run = await ws.run(['status']);
    expect(run.code).toBe(0);
    expect(run.out[0]).toBe('statuses: none');
  });
});
