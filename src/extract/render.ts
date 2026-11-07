import { isKebabCase } from '../triage/tags.js';
import { RULE_STATUSES, type RuleKind, type RuleStatus, type SheetPayload } from './payload.js';

/**
 * Markdown punctuation that could open a link, an image, a heading, emphasis, a table, a fenced block or an
 * autolink (`:` and `.` break `https://` and `www.` autolinks, `@` an email one) or math (`$`, `^`); `&`, `<` and
 * `>` become entities.
 */
const SPECIAL = /[\\`*_{}[\]()#+\-.!|~:@=$^]|[&<>]/g;
const ENTITIES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const ESCAPED = /\\([\\`*_{}[\]()#+\-.!|~:@=$^])|&(amp|lt|gt);/g;
const DECODED: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>' };

/** Renders untrusted text as inert Markdown: every special character escaped, HTML as entities (NFR-4). */
export const escapeMarkdown = (text: string): string =>
  text.replace(SPECIAL, (char) => ENTITIES[char] ?? `\\${char}`);

/** Inverse of `escapeMarkdown`, so a parsed item is escaped again before it leaves the CLI. */
export const unescapeMarkdown = (text: string): string =>
  text.replace(ESCAPED, (_match, punct: string | undefined, entity: string | undefined) =>
    punct ?? DECODED[entity ?? ''] ?? '',
  );

/** A rule as a sheet stores it and `notes` reads it back; the text is plain (unescaped). */
export interface ParsedRule {
  readonly id: string;
  readonly rank: number;
  readonly status: RuleStatus;
  readonly kind: RuleKind;
  readonly text: string;
  readonly evidence?: string;
}

/** A sheet as `notes` needs it: its id, domain, target skill and rules. */
export interface ParsedSheet {
  readonly id: string;
  readonly domain: string;
  readonly targetSkill: string;
  readonly rules: readonly ParsedRule[];
}

/** The rule line: `- [<id>#<rank>] <status> (<kind>) <escaped text>[ — evidence \`<url>\`]` (REQ-12). */
const RULE_LINE = new RegExp(
  `^- \\[([0-9a-f]{12})#([1-9])\\] (${RULE_STATUSES.join('|')}) \\((technical|design)\\) (.+?)(?: — evidence \`(https://[^\\s\`<>]+)\`)?$`,
);

const ruleLine = (rule: ParsedRule): string =>
  `- [${rule.id}#${String(rule.rank)}] ${rule.status} (${rule.kind}) ${escapeMarkdown(rule.text)}${
    rule.evidence === undefined ? '' : ` — evidence \`${rule.evidence}\``
  }`;

/** Renders `knowledge/<domain>/<id>.md` from a validated payload; domain and tags come from the index row. */
export const renderSheet = (id: string, domain: string, tags: readonly string[], sheet: SheetPayload): string => {
  const rules = [...sheet.rules]
    .sort((a, b) => a.rank - b.rank)
    .map((rule) => ruleLine({ id, ...rule }));
  return [
    '---',
    `id: ${id}`,
    `domain: ${domain}`,
    `tags: [${tags.join(', ')}]`,
    `targetSkill: ${sheet.targetSkill}`,
    `promptVersion: ${sheet.promptVersion}`,
    `model: ${sheet.model}`,
    ...(sheet.gem === true ? ['gem: true'] : []),
    '---',
    '',
    `# ${escapeMarkdown(sheet.title)}`,
    '',
    sheet.summary.map(escapeMarkdown).join('\n'),
    '',
    '## Rules',
    '',
    ...rules,
    '',
    '## Justification',
    '',
    escapeMarkdown(sheet.justification),
    ...(sheet.author === undefined ? [] : ['', `Author: \`${sheet.author}\``]),
    '',
  ].join('\n');
};

const frontMatterValue = (markdown: string, key: string): string | undefined =>
  new RegExp(`^${key}: ([a-z0-9-]+)$`, 'm').exec(markdown)?.[1];

/**
 * Reads a sheet back (ADR-0003 decision 3): the rank comes from the `[<id>#<n>]` token, never from the
 * item's position, so a rule removed by hand leaves its siblings' citations intact. Lines that do not
 * match the rule pattern are ignored; a sheet without id, domain or a kebab-case target skill yields undefined.
 */
export const parseSheet = (markdown: string): ParsedSheet | undefined => {
  const id = /^id: ([0-9a-f]{12})$/m.exec(markdown)?.[1];
  const domain = frontMatterValue(markdown, 'domain');
  const targetSkill = frontMatterValue(markdown, 'targetSkill');
  if (id === undefined || domain === undefined || targetSkill === undefined || !isKebabCase(targetSkill)) return undefined;
  const rules: ParsedRule[] = [];
  for (const text of markdown.split('\n')) {
    const match = RULE_LINE.exec(text);
    if (match?.[1] !== id) continue;
    const [, , rank = '', status = '', kind = '', body = '', url] = match;
    rules.push({
      id,
      rank: Number(rank),
      status: status as RuleStatus,
      kind: kind as RuleKind,
      text: unescapeMarkdown(body),
      ...(url === undefined ? {} : { evidence: url }),
    });
  }
  return { id, domain, targetSkill, rules };
};

/** One field-notes item: the rule line, re-escaped from plain text, and the sheet URL on `main` (SEQ-enrichment-pr). */
export const renderItem = (rule: ParsedRule, sheetUrl: string): string => `${ruleLine(rule)} — sheet <${sheetUrl}>`;
