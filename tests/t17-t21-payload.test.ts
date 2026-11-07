import { describe, expect, it } from 'vitest';

import { uncitedNotes } from '../src/extract/notes.js';
import { SheetPayloadSchema } from '../src/extract/payload.js';
import { escapeMarkdown, parseSheet, renderSheet, unescapeMarkdown } from '../src/extract/render.js';
import { sheetPayload } from './helpers.js';

const ID = 'abcdef012345';
const parse = (patch: Record<string, unknown>) => SheetPayloadSchema.safeParse({ ...sheetPayload, ...patch });
const rule = (patch: Record<string, unknown>) => ({ rules: [{ ...sheetPayload.rules[0], ...patch }] });

describe('sheet payload schema (T-17)', () => {
  it('accepts the reference payload', () => {
    expect(parse({}).success).toBe(true);
  });

  it('accepts an emoji sequence joined by a zero-width joiner, refuses a lone joiner', () => {
    expect(parse({ title: 'Dev \u{1F469}‍\u{1F4BB} tips' }).success).toBe(true);
    expect(parse({ title: 'Dev‍tips' }).success).toBe(false);
  });

  it.each([
    ['a technical rule with a design status', rule({ status: 'consistent' })],
    ['a design rule with a technical status', rule({ kind: 'design', status: 'verified' })],
    ['a title over 80 characters', { title: 'x'.repeat(81) }],
    ['a rule over 300 characters', rule({ text: 'x'.repeat(301) })],
    ['a justification over 600 characters', { justification: 'x'.repeat(601) }],
    ['a summary of 4 lines', { summary: 'a\nb\nc\nd' }],
    ['a control character', { title: 'bell\u0007' }],
    ['a bidi override', { justification: 'abc‮def' }],
    ['a newline in a title', { title: 'one\ntwo' }],
    ['a Unicode tag character', rule({ text: 'Use flexbox\u{E0041}\u{E0042}' })],
    ['a zero-width space', { title: 'zero​width' }],
    ['a byte-order mark in the summary', { summary: 'line one\n﻿line two' }],
    ['http evidence', rule({ evidence: 'http://example.com' })],
    ['a backtick in the evidence', rule({ evidence: 'https://example.com/`x`' })],
    ['an angle bracket in the evidence', rule({ evidence: 'https://example.com/<x>' })],
    ['a handle without @', { author: 'devtips' }],
    ['a handle with a space', { author: '@dev tips' }],
    ['duplicate ranks', { rules: [sheetPayload.rules[0], { ...sheetPayload.rules[1], rank: 1 }] }],
    ['a rank of 10', rule({ rank: 10 })],
    ['ten rules', { rules: Array.from({ length: 10 }, (_, i) => ({ ...sheetPayload.rules[0], rank: (i % 9) + 1 })) }],
    ['a target skill that is not kebab-case', { targetSkill: '../etc' }],
    ['an unknown key', { domain: 'design' }],
    ['free text as model', { model: 'A sentence with spaces' }],
  ])('rejects %s', (_label, patch) => {
    expect(parse(patch).success).toBe(false);
  });
});

describe('untrusted text renders inert (T-21) and round-trips through notes (T-20)', () => {
  const hostile = '[click](https://evil.example) ![img](x.png) <script>alert(1)</script> **bold** `code` www.evil.example a@b.co';
  const payload = SheetPayloadSchema.parse({
    ...sheetPayload,
    title: '# Heading <b>',
    summary: '```js\n=====',
    rules: [{ rank: 3, text: hostile, kind: 'design', status: 'in-tension' }],
    justification: '| table | row |',
  });
  const sheet = renderSheet(ID, 'design', ['ui'], payload);

  it('escapes Markdown and HTML in every free-text field', () => {
    expect(sheet).not.toMatch(/<script>|<b>|\]\(|!\[|```|\*\*|^=+$|https:\/\/evil|www\.evil/m);
    expect(sheet).toContain('# \\# Heading &lt;b&gt;');
    expect(sheet).toContain('\\| table \\| row \\|');
  });

  it('escapes math delimiters', () => {
    expect(escapeMarkdown('$x^2$')).toBe('\\$x\\^2\\$');
  });

  it('escape and unescape are inverse', () => {
    expect(unescapeMarkdown(escapeMarkdown(hostile))).toBe(hostile);
  });

  it('parses back what the renderer wrote, rank from the token', () => {
    const parsed = parseSheet(sheet);

    expect(parsed).toMatchObject({ id: ID, domain: 'design', targetSkill: 'react-patterns' });
    expect(parsed?.rules).toEqual([{ id: ID, rank: 3, status: 'in-tension', kind: 'design', text: hostile }]);
  });

  it('a notes item is the same inert line plus the sheet URL', () => {
    const parsed = parseSheet(sheet);
    const [notes] = uncitedNotes(parsed === undefined ? [] : [parsed], () => '');

    expect(notes?.toConfirm[0]).toBe(
      `${sheet.split('\n').find((line) => line.startsWith(`- [${ID}#3]`)) ?? ''} — sheet <https://github.com/benoit-bremaud/screenshot-triage/blob/main/knowledge/design/${ID}.md>`,
    );
  });

  it('keeps evidence as a code span through the round trip', () => {
    const technical = renderSheet(ID, 'frontend', [], SheetPayloadSchema.parse(sheetPayload));

    expect(parseSheet(technical)?.rules[0]?.evidence).toBe('https://react.dev/reference/react/useId');
    expect(technical).toContain('— evidence `https://react.dev/reference/react/useId`');
  });

  it('a sheet without a valid front matter is ignored', () => {
    expect(parseSheet('# no front matter')).toBeUndefined();
    expect(parseSheet(sheet.replace('targetSkill: react-patterns', 'targetSkill: ../x'))).toBeUndefined();
  });
});
