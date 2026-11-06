import { z } from 'zod';

import { DOMAINS } from './domains.js';
import { DOUBT_CATEGORIES } from './status.js';
import { isKebabCase } from './tags.js';

/**
 * The one schema every stdin payload is validated against (ADR-0002 § Consequences).
 * Free text (reasoning) is accepted as an opaque string and never interpreted.
 */
const tag = z.string().min(1).refine(isKebabCase, 'Tags are kebab-case English');

const common = {
  promptVersion: z.string().min(1),
  model: z.string().min(1),
  reasoning: z.string().min(1),
};

export const FileDecisionSchema = z.strictObject({
  ...common,
  domain: z.enum(DOMAINS),
  tags: z.array(tag),
  consideredTags: z.array(tag).default([]),
  /** Absent on an owner correction (glossary "Correction"). */
  confidence: z.number().min(0).max(1).optional(),
});

export const DoubtDecisionSchema = z.strictObject({
  ...common,
  category: z.enum(DOUBT_CATEGORIES),
});

export type FileDecision = z.infer<typeof FileDecisionSchema>;
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
  readonly confidence?: number;
  readonly answer?: 'work' | 'correction';
}

/** Two log lines are identical when every field but the timestamp matches (glossary). */
export const sameDecision = (a: DecisionLine, b: DecisionLine): boolean => {
  const strip = ({ timestamp: _timestamp, ...rest }: DecisionLine): string => JSON.stringify(rest);
  return strip(a) === strip(b);
};
