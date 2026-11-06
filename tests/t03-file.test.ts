import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fileDecision, png, Workspace } from './helpers.js';

describe('T-3 file: Inbox → Triaged, labels logged, reasoning kept private', () => {
  let ws: Workspace;
  let id: string;
  beforeEach(async () => {
    ws = await Workspace.create();
    id = await ws.addCapture('My secret screenshot.png', png('one'));
    await ws.scan();
  });
  afterEach(() => ws.dispose());

  it('moves the file into the domain folder and writes the row with the reasoning', async () => {
    const run = await ws.file(id, {});
    expect(run.code).toBe(0);
    expect(await ws.exists('data', 'frontend', `${id}.png`)).toBe(true);
    expect(await ws.exists('data', 'inbox', `${id}.png`)).toBe(false);
    const [row] = await ws.rowById(id);
    expect(row).toMatchObject({ status: 'triaged', domain: 'frontend', tags: ['react', 'hooks'], reasoning: fileDecision.reasoning });
  });

  it('logs labels only: hash, no ref, no filename, no reasoning (REQ-4, REQ-5, NFR-1)', async () => {
    await ws.file(id, {});
    const [line] = await ws.log();
    expect(line).toEqual({
      contentHash: expect.stringMatching(new RegExp(`^${id}[0-9a-f]{52}$`)),
      timestamp: '2026-11-06T12:00:00.000Z',
      promptVersion: 'triage-v1',
      model: 'claude-sonnet-5-5',
      domain: 'frontend',
      tags: ['react', 'hooks'],
      consideredTags: ['react-hooks'],
      confidence: 0.9,
    });
    const text = await ws.logText();
    expect(text).not.toContain('secret');
    expect(text).not.toContain('reasoning');
    expect(text).not.toContain('ref');
  });

  it('skips the append on an identical log line (a re-run after a crash), appends when any label differs', async () => {
    await ws.file(id, {});
    await ws.rewriteIndex((row) => ({ ...row, status: 'inbox' }));
    ws.now = new Date('2026-11-06T13:00:00Z');
    await ws.file(id, {});
    expect(await ws.log()).toHaveLength(1);
    expect((await ws.rowById(id))[0]?.status).toBe('triaged');
    await ws.rewriteIndex((row) => ({ ...row, status: 'inbox' }));
    await ws.file(id, { tags: ['react'] });
    expect(await ws.log()).toHaveLength(2);
  });

  it('completes a half-done file: the copy already in the domain folder is found again', async () => {
    const { rename, mkdir } = await import('node:fs/promises');
    await mkdir(`${ws.data}/frontend`, { recursive: true });
    await rename(`${ws.data}/inbox/${id}.png`, `${ws.data}/frontend/${id}.png`);
    const run = await ws.file(id, {});
    expect(run.code).toBe(0);
    expect((await ws.rowById(id))[0]?.status).toBe('triaged');
  });
});
