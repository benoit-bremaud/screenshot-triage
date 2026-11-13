import { chmod, mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { png, triagedCapture, Workspace } from './helpers.js';

interface ArchiveReport {
  readonly archived: number;
  readonly failed: readonly string[];
  readonly dryRun: boolean;
}

describe('UC7 archive (T-24)', () => {
  let ws: Workspace;
  beforeEach(async () => {
    ws = await Workspace.create();
  });
  afterEach(async () => {
    await chmod(ws.source, 0o755).catch(() => undefined);
    await ws.dispose();
  });

  /** A frontend capture with a duplicate, an `other` capture and a doubtful one. */
  const setup = async (): Promise<{ id: string; other: string; doubtful: string }> => {
    const id = await triagedCapture(ws, 'a.png', png('a'));
    await ws.addCapture('copy/a.png', png('a'));
    const other = await triagedCapture(ws, 'o.png', png('o'), 'other');
    const doubtful = await ws.addCapture('d.png', png('d'));
    await ws.scan();
    await ws.doubt(doubtful);
    return { id, other, doubtful };
  };

  it('moves every triaged capture, other included, and its duplicates into Archive/, keeps the local copy, logs nothing', async () => {
    const { id, other, doubtful } = await setup();
    const logBefore = await ws.logText();

    const run = await ws.run(['archive', '--source', ws.source]);

    expect(run.code).toBe(0);
    expect(run.json<ArchiveReport>()).toEqual({ archived: 2, failed: [], dryRun: false });
    expect((await ws.rowById(id)).map((row) => row.status)).toEqual(['archived', 'archived']);
    expect((await ws.rowById(other))[0]?.status).toBe('archived');
    expect((await ws.rowById(doubtful))[0]?.status).toBe('doubtful');
    expect((await ws.list('source', 'Archive')).sort()).toEqual([`${id}.png`, `${other}.png`].sort());
    expect(await ws.exists('source', 'a.png')).toBe(false);
    expect(await ws.list('source', 'copy')).toEqual([]);
    expect(await ws.exists('source', 'd.png')).toBe(true);
    expect(await ws.list('data', 'frontend')).toEqual([`${id}.png`]);
    expect(await ws.list('data', 'other')).toEqual([`${other}.png`]);
    expect(await ws.logText()).toBe(logBefore);
  });

  it('--dry-run prints the sheet cleanup, then duplicates first, and changes nothing', async () => {
    const { id } = await setup();

    const run = await ws.run(['archive', '--source', ws.source, '--dry-run']);

    expect(run.json<ArchiveReport>()).toMatchObject({ archived: 2, dryRun: true });
    expect(run.out.filter((line) => line.includes(id))).toEqual([
      `dry-run: remove sheet knowledge/frontend/${id}.md if present`,
      `dry-run: remove thumbnail data/thumbnails/${id}.jpg if present`,
      `dry-run: source.archive(${id}.png)`,
      `dry-run: index: ${id} -> archived`,
      `dry-run: source.archive(${id}.png)`,
      `dry-run: index: ${id} -> archived`,
    ]);
    expect((await ws.rowById(id)).map((row) => row.status).sort()).toEqual(['duplicate', 'triaged']);
    expect(await ws.exists('source', 'Archive')).toBe(false);
  });

  it('removes a sheet left by a crashed extract', async () => {
    const id = await triagedCapture(ws, 'a.png', png('a'));
    await mkdir(join(ws.knowledge, 'frontend'), { recursive: true });
    await writeFile(join(ws.knowledge, 'frontend', `${id}.md`), '# left over\n');

    await ws.run(['archive', '--source', ws.source]);

    expect(await ws.exists('knowledge', 'frontend', `${id}.md`)).toBe(false);
  });

  it('a re-run after a crash between a duplicate and its original completes', async () => {
    const { id } = await setup();
    await mkdir(join(ws.source, 'Archive'), { recursive: true });
    await rename(join(ws.source, 'copy', 'a.png'), join(ws.source, 'Archive', `${id}.png`));

    const run = await ws.run(['archive', '--source', ws.source]);

    expect(run.json<ArchiveReport>()).toMatchObject({ archived: 2, failed: [] });
    expect((await ws.rowById(id)).map((row) => row.status)).toEqual(['archived', 'archived']);
    expect(await ws.exists('source', 'a.png')).toBe(false);
  });

  it('every later command on an archived capture is rejected', async () => {
    const { id } = await setup();
    await ws.run(['archive', '--source', ws.source]);

    expect((await ws.file(id, { model: 'owner', confidence: undefined })).code).toBe(1);
    expect((await ws.resolve(id, 'delete')).code).toBe(1);
    expect((await ws.run(['archive', '--source', ws.source])).json<ArchiveReport>()).toEqual({ archived: 0, failed: [], dryRun: false });
  });

  // A read-only folder does not stop root, so the failure cannot be provoked that way.
  it.skipIf(process.getuid?.() === 0)('a failed source call exits 3, flags the row triaged, a re-run completes', async () => {
    const id = await triagedCapture(ws, 'a.png', png('a'));
    await chmod(ws.source, 0o555);

    const failed = await ws.run(['archive', '--source', ws.source]);

    expect(failed.code).toBe(3);
    expect(failed.json<ArchiveReport>()).toMatchObject({ archived: 0, failed: [id] });
    expect((await ws.rowById(id))[0]).toMatchObject({ status: 'triaged', error: 'archive failed' });

    await chmod(ws.source, 0o755);
    const rerun = await ws.run(['archive', '--source', ws.source]);
    expect(rerun.code).toBe(0);
    expect((await ws.rowById(id))[0]?.status).toBe('archived');
    expect((await ws.rowById(id))[0]?.error).toBeUndefined();
  });

  it.skipIf(process.getuid?.() === 0)('a failed error flag is reported next to the archive failure', async () => {
    const id = await triagedCapture(ws, 'a.png', png('a'));
    await chmod(ws.source, 0o555);
    await chmod(ws.data, 0o555);

    const run = await ws.run(['archive', '--source', ws.source]);
    await chmod(ws.data, 0o755);

    expect(run.code).toBe(3);
    expect(run.err.join('\n')).toContain(`could not flag ${id}`);
  });

  it('needs --source and takes no positional argument', async () => {
    expect((await ws.run(['archive'])).code).toBe(2);
    expect((await ws.run(['archive', 'abcdef012345', '--source', ws.source])).code).toBe(2);
  });
});

describe('scan and the archive (T-25)', () => {
  let ws: Workspace;
  beforeEach(async () => {
    ws = await Workspace.create();
  });
  afterEach(async () => {
    await ws.dispose();
  });

  it('skips Archive/ and archives at once a returning copy, even after the index is lost', async () => {
    const id = await triagedCapture(ws, 'a.png', png('a'));
    await ws.run(['archive', '--source', ws.source]);
    await ws.removeIndex();
    await ws.addCapture('back/a.png', png('a'));

    const run = await ws.scan();

    expect(run.json<{ inbox: unknown[]; seen: Record<string, number> }>()).toMatchObject({ inbox: [], seen: { archived: 1 } });
    expect(await ws.list('source', 'back')).toEqual([]);
    expect(await ws.list('source', 'Archive')).toEqual([`${id}.png`]);
  });

  it('a file moved back out of Archive/ is triaged again as new', async () => {
    const id = await triagedCapture(ws, 'a.png', png('a'));
    await ws.run(['archive', '--source', ws.source]);
    await rename(join(ws.source, 'Archive', `${id}.png`), join(ws.source, 'a.png'));

    const run = await ws.scan();

    expect(run.json<{ seen: Record<string, number> }>().seen).toEqual({ inbox: 1 });
    expect((await ws.rowById(id)).at(-1)?.status).toBe('inbox');
  });
});
