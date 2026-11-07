/** The eight fixed domains a capture is filed into (REQ-1, ADR-0001 § Taxonomy). */
export const DOMAINS = [
  'frontend',
  'design',
  'backend',
  'devops',
  'ai-tooling',
  'product',
  'career',
  'other',
] as const;

export type Domain = (typeof DOMAINS)[number];
