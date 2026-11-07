import { idOf } from '../triage/capture.js';
import { DOMAINS, type Domain } from '../triage/domains.js';
import type { Status } from '../triage/status.js';
import { NEW_SKILL_THRESHOLD } from '../triage/tags.js';
import { EXIT_OK, entryOf, type CaptureEntry, type CommandContext } from './context.js';

const OLD_OTHER_DAYS = 90;
const DAY_MS = 86_400_000;

/** A tag with its capture count; five or more make a new-skill candidate (ADR-0001 § Taxonomy). */
export interface TagCount {
  readonly tag: string;
  readonly count: number;
  readonly newSkillCandidate: boolean;
}

/** The UC3 report (REQ-7), printed as JSON with `--json`, as text otherwise. */
export interface StatusReport {
  readonly byStatus: Partial<Record<Status, number>>;
  readonly byDomain: Partial<Record<Domain, number>>;
  /** Doubtful captures awaiting an answer: the list UC2 iterates. */
  readonly doubtful: readonly (CaptureEntry & { category?: string; reasoning?: string })[];
  /** Triaged captures with their domain and tags: the list UC4 extracts (REQ-17). */
  readonly triaged: readonly (CaptureEntry & { domain?: Domain; tags: readonly string[] })[];
  readonly tags: readonly TagCount[];
  /** Triaged `other` captures taken more than 90 days ago. */
  readonly oldOther: readonly { id: string; takenAt: string }[];
}

/** Tags with their capture counts, over every row that carries tags. */
export const tagCounts = (context: CommandContext): TagCount[] => {
  const counts = new Map<string, number>();
  for (const row of context.index.all()) {
    for (const tag of row.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count, newSkillCandidate: count >= NEW_SKILL_THRESHOLD }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
};

/** Builds the UC3 report from the index; `status` prints it. */
export const buildStatus = async (context: CommandContext): Promise<StatusReport> => {
  const rows = context.index.all();
  const byStatus: Partial<Record<Status, number>> = {};
  const byDomain: Partial<Record<Domain, number>> = {};
  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    if (row.domain !== undefined) byDomain[row.domain] = (byDomain[row.domain] ?? 0) + 1;
  }
  const doubtful: StatusReport['doubtful'][number][] = [];
  for (const row of rows) {
    if (row.status !== 'doubtful') continue;
    doubtful.push({
      ...(await entryOf(context, row)),
      ...(row.category === undefined ? {} : { category: row.category }),
      ...(row.reasoning === undefined ? {} : { reasoning: row.reasoning }),
    });
  }
  const triaged: StatusReport['triaged'][number][] = [];
  for (const row of rows) {
    if (row.status !== 'triaged') continue;
    triaged.push({
      ...(await entryOf(context, row)),
      ...(row.domain === undefined ? {} : { domain: row.domain }),
      tags: row.tags ?? [],
    });
  }
  const limit = context.now().getTime() - OLD_OTHER_DAYS * DAY_MS;
  return {
    byStatus,
    byDomain,
    doubtful,
    triaged,
    tags: tagCounts(context),
    oldOther: rows
      .filter((row) => row.domain === 'other' && row.status === 'triaged' && Date.parse(row.takenAt) < limit)
      .map((row) => ({ id: idOf(row.contentHash), takenAt: row.takenAt })),
  };
};

/** `status [--json]`: UC3. */
export const status = async (context: CommandContext, json: boolean): Promise<number> => {
  const report = await buildStatus(context);
  if (json) {
    context.out(JSON.stringify(report));
    return EXIT_OK;
  }
  context.out(`statuses: ${format(report.byStatus)}`);
  context.out(`domains: ${format(report.byDomain)}`);
  context.out(`doubtful: ${String(report.doubtful.length)} awaiting an answer`);
  for (const item of report.doubtful) context.out(`  ${item.id} ${item.category ?? ''}`);
  context.out(`triaged: ${String(report.triaged.length)} to extract`);
  for (const item of report.triaged) context.out(`  ${item.id} ${item.domain ?? ''} ${item.tags.join(',')}`);
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

const format = (counts: Partial<Record<string, number>>): string =>
  Object.entries(counts)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ') || 'none';
