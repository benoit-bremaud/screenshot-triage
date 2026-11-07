import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { png, Workspace } from './helpers.js';

describe('T-8 file on a triaged capture is a correction', () => {
  let ws: Workspace;
  beforeEach(async () => {
    ws = await Workspace.create();
  });
  afterEach(() => ws.dispose());

  it('moves the file to the new domain and logs answer = correction with model owner, no confidence', async () => {
    const id = await ws.addCapture('a.png', png('one'));
    await ws.scan();
    await ws.file(id, {});
    const run = await ws.file(id, { domain: 'design', model: 'owner', confidence: undefined, reasoning: 'Owner: this is a design rule.' });
    expect(run.code).toBe(0);
    expect(await ws.exists('data', 'design', `${id}.png`)).toBe(true);
    expect(await ws.exists('data', 'frontend', `${id}.png`)).toBe(false);
    const lines = await ws.log();
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({ domain: 'design', model: 'owner', answer: 'correction' });
    expect(lines[1]).not.toHaveProperty('confidence');
    expect((await ws.rowById(id))[0]).toMatchObject({ status: 'triaged', domain: 'design' });
  });
});
