import { describe, expect, it } from 'vitest';

import type { CaptureRow } from '../src/triage/capture.js';
import { FileDecisionSchema, type DoubtDecision, type FileDecision } from '../src/triage/decision.js';
import { STATUSES, type Status } from '../src/triage/status.js';
import { transition, type Event } from '../src/triage/transition.js';

const row = (status: Status): CaptureRow => ({
  ref: 'a.png',
  name: 'a.png',
  takenAt: '2026-11-01T00:00:00.000Z',
  size: 10,
  contentHash: 'abcdef012345'.padEnd(64, '0'),
  ext: 'png',
  status,
});

const decision: FileDecision = {
  promptVersion: 'triage-v1',
  model: 'owner',
  reasoning: 'Text.',
  domain: 'frontend',
  tags: ['react'],
  consideredTags: [],
};
const doubtDecision: DoubtDecision = { promptVersion: 'triage-v1', model: 'm', reasoning: 'Text.', category: 'off-topic' };

const events: Record<'file' | 'doubt' | 'resolve', Event> = {
  file: { type: 'file', decision, timestamp: '2026-11-06T12:00:00.000Z' },
  doubt: { type: 'doubt', decision: doubtDecision },
  resolve: { type: 'resolve', answer: 'delete', duplicates: [] },
};

/** The legal (status, command) pairs of 05-state-capture; every other pair is rejected (REQ-8). */
const legal = new Set(['inbox:file', 'triaged:file', 'inbox:doubt', 'doubtful:resolve']);

const cases = STATUSES.flatMap((status) =>
  (['file', 'doubt', 'resolve'] as const).map((command) => ({ status, command })),
);

describe('transition matrix (REQ-8)', () => {
  it.each(cases)('$command on a $status capture', ({ status, command }) => {
    // A first filing carries a confidence; an owner correction never does.
    const event = command === 'file' && status !== 'triaged' ? { ...events.file, decision: { ...decision, confidence: 0.9 } } : events[command];
    const result = transition(row(status), event as Event);

    expect(result.ok).toBe(legal.has(`${status}:${command}`));
    if (!result.ok) expect(result.current).toBe(status);
  });

  it.each(['file', 'doubt', 'resolve'] as const)('%s on an unknown capture is rejected without a status', (command) => {
    const result = transition(undefined, events[command]);

    expect(result).toMatchObject({ ok: false, current: undefined, reason: 'unknown capture' });
  });

  it('a first filing without a confidence is rejected', () => {
    expect(transition(row('inbox'), events.file)).toMatchObject({ ok: false, reason: 'a first filing carries a confidence' });
  });

  it('a correction from the model, or with a confidence, is rejected', () => {
    const fromModel = transition(row('triaged'), { ...events.file, decision: { ...decision, model: 'claude-sonnet-5-5' } } as Event);
    const withConfidence = transition(row('triaged'), { ...events.file, decision: { ...decision, confidence: 0.5 } } as Event);

    expect(fromModel.ok).toBe(false);
    expect(withConfidence.ok).toBe(false);
  });

  it('doubt is rejected once the owner kept the capture as work', () => {
    const result = transition({ ...row('inbox'), doubtAnswer: 'work' }, events.doubt);

    expect(result.ok).toBe(false);
  });

  it('resolve personal drops every private text from the rows it writes', () => {
    const doubtful = { ...row('doubtful'), ocrText: 'ocr', reasoning: 'r', category: 'off-topic' as const };
    const result = transition(doubtful, { type: 'resolve', answer: 'personal', duplicates: [] });

    if (!result.ok) throw new Error('expected ok');
    const written = result.effects.flatMap((effect) => (effect.kind === 'index-write' ? [effect.row] : []));
    expect(written).toHaveLength(1);
    expect(written[0]).not.toHaveProperty('ocrText');
    expect(written[0]).not.toHaveProperty('reasoning');
    expect(written[0]).not.toHaveProperty('category');
  });
});

describe('decision schema keeps free text out of the public log (CLAUDE.md)', () => {
  const valid = { ...decision, model: 'claude-sonnet-5-5' };

  it.each([
    ['model', 'Reading the screenshot, I think this is about React'],
    ['promptVersion', 'v1 because the owner said so'],
  ])('refuses a sentence in %s', (field, value) => {
    expect(FileDecisionSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });

  it('refuses an oversized tag and too many tags', () => {
    expect(FileDecisionSchema.safeParse({ ...valid, tags: ['a'.repeat(41)] }).success).toBe(false);
    expect(FileDecisionSchema.safeParse({ ...valid, tags: Array.from({ length: 33 }, (_, i) => `t${String(i)}`) }).success).toBe(false);
  });

  it('refuses a repeated tag', () => {
    expect(FileDecisionSchema.safeParse({ ...valid, tags: ['react', 'react'] }).success).toBe(false);
    expect(FileDecisionSchema.safeParse({ ...valid, consideredTags: ['hooks', 'hooks'] }).success).toBe(false);
  });

  it('accepts a regular decision', () => {
    expect(FileDecisionSchema.safeParse(valid).success).toBe(true);
  });
});
