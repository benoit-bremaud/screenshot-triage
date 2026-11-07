import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DOMAINS } from '../src/triage/domains.js';
import { png, Workspace } from './helpers.js';

describe('T-11 domains and T-12 tags', () => {
  let ws: Workspace;
  let id: string;
  beforeEach(async () => {
    ws = await Workspace.create();
    id = await ws.addCapture('a.png', png('one'));
    await ws.scan();
  });
  afterEach(() => ws.dispose());

  it('T-11: an invented domain is rejected, nothing moves, nothing logged', async () => {
    const run = await ws.file(id, { domain: 'marketing' });
    expect(run.code).toBe(2);
    expect(run.err[0]).toContain('domain');
    expect(await ws.exists('data', 'inbox', `${id}.png`)).toBe(true);
    expect(await ws.logText()).toBe('');
  });

  it('T-12: a tag that is not kebab-case English is rejected', async () => {
    for (const tag of ['React', 'react hooks', 'réact', 'react_hooks', '-react', '']) {
      const run = await ws.file(id, { tags: [tag] });
      expect(run.code, tag).toBe(2);
    }
  });

  it('T-12: tags lists the domains and the current tags with counts for the prompt', async () => {
    const empty = (await ws.run(['tags'])).json<{ domains: string[]; tags: unknown[] }>();
    expect(empty).toEqual({ domains: [...DOMAINS], tags: [] });
    await ws.file(id, { tags: ['react', 'hooks'] });
    const after = (await ws.run(['tags'])).json<{ tags: { tag: string; count: number }[] }>();
    expect(after.tags.map((tag) => tag.tag)).toEqual(['hooks', 'react']);
  });

  it('T-12: a new tag is accepted with the considered tags, and is reused on the next capture', async () => {
    await ws.file(id, { tags: ['server-components'], consideredTags: ['react'] });
    expect((await ws.log())[0]?.consideredTags).toEqual(['react']);
    const other = await ws.addCapture('b.png', png('two'));
    await ws.scan();
    await ws.file(other, { tags: ['server-components'], consideredTags: [] });
    const report = (await ws.run(['tags'])).json<{ tags: { tag: string; count: number }[] }>();
    expect(report.tags).toEqual([{ tag: 'server-components', count: 2, newSkillCandidate: false }]);
  });

  it('rejects a payload with unknown keys, a malformed JSON, or a confidence out of range', async () => {
    expect((await ws.file(id, { extra: 1 })).code).toBe(2);
    expect((await ws.file(id, { confidence: 1.5 })).code).toBe(2);
    expect((await ws.run(['file', id], '{not json')).code).toBe(2);
  });
});
