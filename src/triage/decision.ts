import { z } from 'zod';

import { DOMAINS } from './domains.js';
import { DOUBT_CATEGORIES } from './status.js';
import { isKebabCase } from './tags.js';

/** Identifiers that reach the public log are tokens, never sentences (CLAUDE.md "nothing private in Git"). */
const TOKEN = /^[a-z0-9][a-z0-9.:-]{0,39}$/;

/** A label that may reach the public log: a short token, never a sentence. */
export const token = z.string().regex(TOKEN, 'A token: lowercase letters, digits, dot, colon or dash, 40 characters at most');

const tag = z.string().max(40).refine(isKebabCase, 'Tags are kebab-case English');

/** A capture counts once per tag (`status` new-skill threshold), so a list never repeats a tag. */
const tagList = z
  .array(tag)
  .max(32)
  .refine((tags) => new Set(tags).size === tags.length, 'Tags must be unique');

const common = {
  promptVersion: token,
  model: token,
  /** Opaque model text: stored in the private index only, never interpreted or logged. */
  reasoning: z.string().min(1).max(4000),
};

/**
 * Schema of the `file <id>` stdin payload (ADR-0002 § Consequences). Strict: unknown keys are rejected.
 * `confidence` is 0..1 and absent on an owner correction, required on a first filing (enforced in `transition`, which knows the status) (glossary "Correction").
 */
export const FileDecisionSchema = z.strictObject({
  ...common,
  domain: z.enum(DOMAINS),
  tags: tagList,
  consideredTags: tagList.default([]),
  confidence: z.number().min(0).max(1).optional(),
});

/** Schema of the `doubt <id>` stdin payload: a category and the reasoning, kept in the private index only. */
export const DoubtDecisionSchema = z.strictObject({
  ...common,
  category: z.enum(DOUBT_CATEGORIES),
});

/** A validated `file` payload. */
export type FileDecision = z.infer<typeof FileDecisionSchema>;
/** A validated `doubt` payload. */
export type DoubtDecision = z.infer<typeof DoubtDecisionSchema>;

/** One line of the versioned `knowledge/decisions.jsonl`: labels only, no ref, no free text (REQ-4). */
export interface DecisionLine {
  readonly contentHash: string;
  readonly timestamp: string;
  readonly promptVersion: string;
  readonly model: string;
  readonly domain: FileDecision['domain'];
  readonly tags: readonly string[];
  readonly consideredTags: readonly string[];
  /** 0..1; absent on an owner correction, required on a first filing (enforced in `transition`, which knows the status). */
  readonly confidence?: number;
  /** `work` after a doubt the owner kept, `correction` on a re-file, absent otherwise. */
  readonly answer?: 'work' | 'correction';
}

/** Two log lines are identical when every field but the timestamp matches (glossary). */
export const sameDecision = (a: DecisionLine, b: DecisionLine): boolean => {
  const strip = ({ timestamp: _timestamp, ...rest }: DecisionLine): string => JSON.stringify(rest);
  return strip(a) === strip(b);
};
