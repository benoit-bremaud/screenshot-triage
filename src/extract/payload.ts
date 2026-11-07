import { z } from 'zod';

import { token } from '../triage/decision.js';
import { isKebabCase } from '../triage/tags.js';

/**
 * Text derived from a screenshot is untrusted (NFR-4): control, format (bidi, zero-width, tag characters),
 * private-use and unassigned code points and line separators are refused, so nothing hides from the owner's review.
 */
const FORBIDDEN = /[\p{Cc}\p{Cf}\p{Co}\p{Cn}\u2028\u2029]/u;

/** A zero-width joiner between two pictographs is part of an emoji sequence (woman technologist, skin tones included), not hidden text. */
const EMOJI_JOINER = /(\p{Extended_Pictographic}[\p{M}\p{Emoji_Modifier}]*)\u200d(?=\p{Extended_Pictographic})/gu;

const isVisible = (text: string): boolean => !FORBIDDEN.test(text.replace(EMOJI_JOINER, '$1'));

const line = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(isVisible, 'One line, no control or invisible character');

/** At most 3 non-empty lines, each trimmed (ADR-0003 consequences). */
const summary = z
  .string()
  .max(600)
  .refine((text) => isVisible(text.replaceAll('\n', '')), 'No control or invisible character')
  .transform((text) => text.split('\n').map((part) => part.trim()).filter((part) => part !== ''))
  .refine((lines) => lines.length >= 1 && lines.length <= 3, 'A summary holds 1 to 3 lines');

/** An `https` URL rendered as a code span: no backtick, angle bracket or whitespace (REQ-10). */
const evidence = z
  .string()
  .max(500)
  .regex(/^https:\/\/[^\s`<>]+$/, 'Evidence is an https URL without backtick, angle bracket or whitespace');

/** Verification outcomes of a technical rule, checked against Context7 or the official docs (REQ-11). */
export const TECHNICAL_STATUSES = ['verified', 'contradicted', 'not-found'] as const;
/** Outcomes of a design rule, confronted with the target skill (REQ-11). */
export const DESIGN_STATUSES = ['consistent', 'in-tension'] as const;
/** Every rule status, in the order the rule pattern lists them. */
export const RULE_STATUSES = [...TECHNICAL_STATUSES, ...DESIGN_STATUSES] as const;
/** One rule status. */
export type RuleStatus = (typeof RULE_STATUSES)[number];
/** Whether a rule is checked against docs (`technical`) or against the target skill (`design`). */
export const RULE_KINDS = ['technical', 'design'] as const;
/** One rule kind. */
export type RuleKind = (typeof RULE_KINDS)[number];

/** Statuses that land in the `adopted` section of the field notes; the others go to `to-confirm` (REQ-15). */
export const ADOPTED_STATUSES: readonly RuleStatus[] = ['verified', 'consistent'];

const RuleSchema = z
  .strictObject({
    rank: z.number().int().min(1).max(9),
    text: line(300),
    kind: z.enum(RULE_KINDS),
    status: z.enum(RULE_STATUSES),
    evidence: evidence.optional(),
  })
  .refine(
    (rule) => (rule.kind === 'technical' ? (TECHNICAL_STATUSES as readonly RuleStatus[]) : (DESIGN_STATUSES as readonly RuleStatus[])).includes(rule.status),
    'A technical rule is verified, contradicted or not-found; a design rule consistent or in-tension (REQ-11)',
  );

/**
 * Schema of the `extract <id>` stdin payload (REQ-10). Strict: unknown keys are rejected; domain and
 * tags are not part of it, they come from the index row.
 */
export const SheetPayloadSchema = z.strictObject({
  promptVersion: token,
  model: token,
  title: line(80),
  summary,
  rules: z
    .array(RuleSchema)
    .min(1)
    .max(9)
    .refine((rules) => new Set(rules.map((rule) => rule.rank)).size === rules.length, 'Rule ranks are unique'),
  justification: line(600),
  targetSkill: z.string().max(64).refine(isKebabCase, 'The target skill is kebab-case'),
  author: z.string().regex(/^@[A-Za-z0-9._]{1,30}$/, 'An Instagram handle: @ then 1 to 30 letters, digits, dots or underscores').optional(),
  gem: z.boolean().optional(),
});

/** A validated `extract` payload, summary already split into lines. */
export type SheetPayload = z.infer<typeof SheetPayloadSchema>;
/** One rule of a validated payload. */
export type SheetRule = SheetPayload['rules'][number];
