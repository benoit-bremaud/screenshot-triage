import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { NotesReport } from '../src/commands/extract.js';
import { extractRun, png, triagedCapture, Workspace } from './helpers.js';

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'init.defaultBranch=main', ...args], { cwd, encoding: 'utf8' });

/** A `~/.claude`-like clone whose origin holds `skills/react-patterns` with `notes` as its field notes. */
const skillsRepo = async (ws: Workspace, notes: string): Promise<{ clone: string; push: (text: string) => Promise<void> }> => {
  const origin = join(ws.root, 'origin.git');
  const clone = join(ws.root, 'claude');
  const author = join(ws.root, 'author');
  git(ws.root, 'init', '--bare', origin);
  git(ws.root, 'clone', '--quiet', origin, author);
  const push = async (text: string): Promise<void> => {
    await mkdir(join(author, 'skills', 'react-patterns', 'references'), { recursive: true });
    await writeFile(join(author, 'skills', 'react-patterns', 'SKILL.md'), '# react-patterns\n');
    await writeFile(join(author, 'skills', 'react-patterns', 'references', 'field-notes.md'), text);
    git(author, 'add', '.');
    git(author, 'commit', '--quiet', '-m', 'notes');
    git(author, 'push', '--quiet', 'origin', 'HEAD:main');
  };
  await push(notes);
  git(ws.root, 'clone', '--quiet', origin, clone);
  return { clone, push };
};

/** The rank of a rendered item, read from its `[<id>#<n>]` token. */
const rankOf = (item: string): string | undefined => /^- \[[0-9a-f]{12}#(\d)\]/.exec(item)?.[1];

const nineRules = Array.from({ length: 9 }, (_, i) => ({
  rank: i + 1,
  text: `Rule number ${String(i + 1)}`,
  kind: 'technical',
  status: i === 0 ? 'contradicted' : 'verified',
}));

describe('UC6 notes (T-20)', () => {
  let ws: Workspace;
  beforeEach(async () => {
    ws = await Workspace.create();
  });
  afterEach(() => ws.dispose());

  it('returns uncited rules split adopted / to-confirm, item-token citations read from origin/main', async () => {
    const id = await triagedCapture(ws, 'a.png', png('a'));
    await extractRun(ws, id, { rules: nineRules });
    // `#10` would match `#1` without the item-token rule; the working tree is stale on purpose.
    const { clone, push } = await skillsRepo(ws, `- [${id}#2] cited\n`);
    await push(`- [${id}#2] cited\n- [${id}#10] not a rule\n- [${id}#9] cited\n`);
    await writeFile(join(clone, 'skills', 'react-patterns', 'references', 'field-notes.md'), `${id}#3 local only\n`);

    const run = await ws.run(['notes', '--skills-dir', join(clone, 'skills')]);

    expect(run.code).toBe(0);
    const report = run.json<NotesReport>();
    expect(report.candidates).toEqual([]);
    const [skill] = report.skills;
    expect(skill?.skill).toBe('react-patterns');
    expect(skill?.toConfirm.map(rankOf)).toEqual(['1']);
    expect(skill?.adopted.map(rankOf)).toEqual(['3', '4', '5', '6', '7', '8']);
  });

  it('keeps a dropped sibling uncited and the others cited after a middle rule is removed by hand', async () => {
    const id = await triagedCapture(ws, 'a.png', png('a'));
    await extractRun(ws, id, { rules: nineRules.slice(0, 3) });
    const sheet = join(ws.knowledge, 'frontend', `${id}.md`);
    await writeFile(sheet, (await readFile(sheet, 'utf8')).replace(/^- \[\w+#2\].*\n/m, ''));
    const { clone } = await skillsRepo(ws, `- [${id}#3] cited\n`);

    const report = (await ws.run(['notes', '--skills-dir', join(clone, 'skills')])).json<NotesReport>();

    expect(report.skills[0]?.toConfirm.map(rankOf)).toEqual(['1']);
    expect(report.skills[0]?.adopted).toEqual([]);
  });

  it('lists a target skill missing on origin/main as a new-skill candidate', async () => {
    const id = await triagedCapture(ws, 'a.png', png('a'));
    await extractRun(ws, id, { targetSkill: 'motion-design' });
    const { clone } = await skillsRepo(ws, '');

    const report = (await ws.run(['notes', '--skills-dir', join(clone, 'skills')])).json<NotesReport>();

    expect(report.candidates).toEqual(['motion-design']);
    expect(report.skills[0]?.skill).toBe('motion-design');
  });

  it('an evidence URL ending in <id>#<n> cites no other rule', async () => {
    const id = await triagedCapture(ws, 'a.png', png('a'));
    await extractRun(ws, id, { rules: nineRules.slice(0, 2) });
    const { clone } = await skillsRepo(ws, `- [${id}#1] cited — evidence \`https://example.com/${id}#2\`\n`);

    const report = (await ws.run(['notes', '--skills-dir', join(clone, 'skills')])).json<NotesReport>();

    expect(report.skills[0]?.adopted.map(rankOf)).toEqual(['2']);
  });

  it('a git error while reading origin/main fails instead of listing the skill as new', async () => {
    const id = await triagedCapture(ws, 'a.png', png('a'));
    await extractRun(ws, id);
    const { clone } = await skillsRepo(ws, '');
    const tree = git(clone, 'rev-parse', 'origin/main^{tree}').trim();
    await rm(join(clone, '.git', 'objects', tree.slice(0, 2), tree.slice(2)), { force: true });

    const run = await ws.run(['notes', '--skills-dir', join(clone, 'skills')]);

    expect(run.code).toBe(3);
    expect(run.out.join('\n')).not.toContain('candidates');
  });

  it('refuses a skills repository without origin/main', async () => {
    const id = await triagedCapture(ws, 'a.png', png('a'));
    await extractRun(ws, id);
    const { clone } = await skillsRepo(ws, '');
    git(ws.root, 'init', '--quiet', '--bare', join(ws.root, 'empty.git'));
    git(clone, 'remote', 'set-url', 'origin', join(ws.root, 'empty.git'));
    git(clone, 'update-ref', '-d', 'refs/remotes/origin/main');

    const run = await ws.run(['notes', '--skills-dir', join(clone, 'skills')]);

    expect(run.code).toBe(2);
    expect(run.err.join('\n')).toContain('no origin/main');
  });

  it('refuses a skills dir outside a git repository, and a missing flag', async () => {
    expect((await ws.run(['notes', '--skills-dir', ws.root])).code).toBe(2);
    expect((await ws.run(['notes'])).code).toBe(2);
  });
});
