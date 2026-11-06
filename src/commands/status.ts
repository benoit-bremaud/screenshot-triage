import { idOf } from '../triage/capture.js';
import { DOMAINS } from '../triage/domains.js';
import { NEW_SKILL_THRESHOLD } from '../triage/tags.js';
import { EXIT_OK, type CommandContext } from './context.js';
import { entry } from './scan.js';

const OLD_OTHER_DAYS = 90;

export interface TagCount {
  readonly tag: string;
  readonly count: number;
  readonly newSkillCandidate: boolean;
}

export interface StatusReport {
  readonly byStatus: Record<string, number>;
  readonly byDomain: Record<string, number>;
  readonly doubtful: readonly { id: string; path: string; category?: string; reasoning?: string }[];
  readonly tags: readonly TagCount[];
  readonly oldOther: readonly { id: string; takenAt: string }[];
}

/** Tags with their capture counts, over every row that carries a domain. */
export const tagCounts = (context: CommandContext): TagCount[] => {
  const counts = new Map<string, number>();
  for (const row of context.index.all()) {
    for (const tag of row.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count, newSkillCandidate: count >= NEW_SKILL_THRESHOLD }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
};

/** UC3 (REQ-7): counts, the doubtful list, tag counts and the old `other` captures. */
export const buildStatus = (context: CommandContext): StatusReport => {
  const rows = context.index.all();
  const byStatus: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    if (row.domain !== undefined) byDomain[row.domain] = (byDomain[row.domain] ?? 0) + 1;
  }
  const limit = context.now().getTime() - OLD_OTHER_DAYS * 24 * 3600 * 1000;
  return {
    byStatus,
    byDomain,
    doubtful: rows
      .filter((row) => row.status === 'doubtful')
      .map((row) => ({
        ...entry(context.dataDir, row),
        ...(row.category === undefined ? {} : { category: row.category }),
        ...(row.reasoning === undefined ? {} : { reasoning: row.reasoning }),
      })),
    tags: tagCounts(context),
    oldOther: rows
      .filter((row) => row.domain === 'other' && row.status === 'triaged' && Date.parse(row.takenAt) < limit)
      .map((row) => ({ id: idOf(row.contentHash), takenAt: row.takenAt })),
  };
};

export const status = (context: CommandContext, json: boolean): number => {
  const report = buildStatus(context);
  if (json) {
    context.out(JSON.stringify(report));
    return EXIT_OK;
  }
  context.out(`statuses: ${format(report.byStatus)}`);
  context.out(`domains: ${format(report.byDomain)}`);
  context.out(`doubtful: ${String(report.doubtful.length)} awaiting an answer`);
  for (const item of report.doubtful) context.out(`  ${item.id} ${item.category ?? ''}`);
  context.out('tags:');
  for (const tag of report.tags) {
    context.out(`  ${tag.tag} ${String(tag.count)}${tag.newSkillCandidate ? ' (new-skill candidate)' : ''}`);
  }
  context.out(`other older than ${String(OLD_OTHER_DAYS)} days: ${String(report.oldOther.length)}`);
  return EXIT_OK;
};

/** `tags`: the facts the skill prompt needs, domains and current tags (ADR-0002 § Consequences). */
export const tags = (context: CommandContext): number => {
  context.out(JSON.stringify({ domains: DOMAINS, tags: tagCounts(context) }));
  return EXIT_OK;
};

const format = (counts: Record<string, number>): string =>
  Object.entries(counts)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ') || 'none';
