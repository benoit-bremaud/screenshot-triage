/** Tags are kebab-case English keywords, reused before created (REQ-2). */
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** True for a kebab-case tag or skill name. */
export const isKebabCase = (tag: string): boolean => KEBAB_CASE.test(tag);

/** Five captures on one tag make it a new-skill candidate (ADR-0001 § Taxonomy). */
export const NEW_SKILL_THRESHOLD = 5;
