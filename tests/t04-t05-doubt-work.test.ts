import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { doubtDecision, png, Workspace } from './helpers.js';

describe('T-4 doubt and T-5 resolve --as work', () => {
  let ws: Workspace;
  let id: string;
  beforeEach(async () => {
    ws = await Workspace.create();
    id = await ws.addCapture('a.png', png('one'));
    await ws.scan();
  });
  afterEach(() => ws.dispose());

  it('T-4: doubt writes the index row only, nothing in the log, the file stays in the inbox', async () => {
    const run = await ws.doubt(id);
    expect(run.code).toBe(0);
    const [row] = await ws.rowById(id);
    expect(row).toMatchObject({ status: 'doubtful', category: 'personal-suspected', reasoning: doubtDecision.reasoning });
    expect(await ws.logText()).toBe('');
    expect(await ws.exists('data', 'inbox', `${id}.png`)).toBe(true);
  });

  it('T-5: resolve work returns the capture to the inbox and the next file logs answer = work', async () => {
    await ws.doubt(id);
    const run = await ws.resolve(id, 'work', ['--dry-run']);
    expect(run.code).toBe(0);
    expect((await ws.rowById(id))[0]).toMatchObject({ status: 'inbox', doubtAnswer: 'work' });
    const scan = await ws.scan();
    expect(scan.json<{ inbox: { doubtAnswer?: string }[] }>().inbox[0]?.doubtAnswer).toBe('work');
    await ws.file(id, {});
    expect((await ws.log())[0]?.answer).toBe('work');
  });

  it('resolve work needs no --source', async () => {
    await ws.doubt(id);
    const run = await ws.run(['resolve', id, '--as', 'work']);
    expect(run.code).toBe(0);
  });
});
