import { ADOPTED_STATUSES } from './payload.js';
import { renderItem, type ParsedRule, type ParsedSheet } from './render.js';

/** Where the published sheets live: the citation URL of a field-notes item (ADR-0003 decision 3). */
export const SHEETS_BASE_URL = 'https://github.com/benoit-bremaud/screenshot-triage/blob/main/knowledge';

/** The public URL of a sheet on `main`, cited by its field-notes items. */
export const sheetUrl = (sheet: Pick<ParsedSheet, 'domain' | 'id'>): string =>
  `${SHEETS_BASE_URL}/${sheet.domain}/${sheet.id}.md`;

/**
 * True when a field-notes item opens with the token `[<id>#<rank>]`: `#1` is not cited by `#10`, and an
 * evidence URL ending in `<id>#<n>` inside another item cites nothing.
 */
export const isCited = (rule: Pick<ParsedRule, 'id' | 'rank'>, fieldNotes: string): boolean =>
  new RegExp(String.raw`^- \[${rule.id}#${String(rule.rank)}\]`, 'm').test(fieldNotes);

/** The uncited rules of one target skill, rendered as escaped items, split by status (REQ-15). */
export interface SkillNotes {
  readonly skill: string;
  readonly adopted: readonly string[];
  readonly toConfirm: readonly string[];
}

/**
 * Groups the uncited rules per target skill. `fieldNotesOf` returns the skill's field notes read from
 * `origin/main` (empty when the file does not exist). Skills with nothing uncited are left out.
 */
export const uncitedNotes = (
  sheets: readonly ParsedSheet[],
  fieldNotesOf: (skill: string) => string,
): SkillNotes[] => {
  const bySkill = new Map<string, { adopted: string[]; toConfirm: string[] }>();
  for (const sheet of sheets) {
    const notes = fieldNotesOf(sheet.targetSkill);
    for (const rule of [...sheet.rules].sort((a, b) => a.rank - b.rank)) {
      if (isCited(rule, notes)) continue;
      const entry = bySkill.get(sheet.targetSkill) ?? { adopted: [], toConfirm: [] };
      const item = renderItem(rule, sheetUrl(sheet));
      (ADOPTED_STATUSES.includes(rule.status) ? entry.adopted : entry.toConfirm).push(item);
      bySkill.set(sheet.targetSkill, entry);
    }
  }
  return [...bySkill.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([skill, entry]) => ({ skill, ...entry }));
};
