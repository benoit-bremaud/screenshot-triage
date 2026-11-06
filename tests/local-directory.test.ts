import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalDirectorySource } from '../src/sources/local-directory.js';
import type { SourceTarget } from '../src/triage/capture.js';

describe('LocalDirectorySource', () => {
  let root: string;
  let source: LocalDirectorySource;
  let target: SourceTarget;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'local-source-'));
    source = new LocalDirectorySource(root);
    await writeFile(join(root, 'a.png'), 'bytes');
    const info = await stat(join(root, 'a.png'));
    target = { localName: 'abcdef012345.png', size: info.size, takenAt: info.mtime.toISOString() };
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  it('moves the scanned file into the trash under its local name', async () => {
    await source.trash('a.png', target);

    expect((await source.finalIds()).trashed).toEqual(new Set(['abcdef012345']));
  });

  it('a re-run after the file is gone is a no-op (crash between two effects)', async () => {
    await source.trash('a.png', target);

    await expect(source.trash('a.png', target)).resolves.toBeUndefined();
  });

  it('refuses a file that changed since the scan', async () => {
    await writeFile(join(root, 'a.png'), 'other bytes');

    await expect(source.markPersonal('a.png', target)).rejects.toThrow('changed since scan');
  });

  it('refuses a file whose time changed since the scan', async () => {
    const later = new Date('2027-01-01T00:00:00Z');
    await utimes(join(root, 'a.png'), later, later);

    await expect(source.trash('a.png', target)).rejects.toThrow('changed since scan');
  });

  it('removes a duplicate whose target name already exists', async () => {
    await mkdir(join(root, 'Personnel'));
    await writeFile(join(root, 'Personnel', target.localName), 'bytes');

    await source.markPersonal('a.png', target);

    expect(await source.listCaptures()).toEqual([]);
  });

  it('accepts a ref starting with two dots and refuses one that escapes the root', async () => {
    await writeFile(join(root, '..x.png'), 'b');

    await expect(source.read('..x.png')).resolves.toBeDefined();
    await expect(source.read('../x.png')).rejects.toThrow('escapes');
    await expect(source.read('')).rejects.toThrow('escapes');
  });

  it('lists ids only from the final folders, ignoring foreign names', async () => {
    await mkdir(join(root, '.trash'));
    await writeFile(join(root, '.trash', 'notes.txt'), 'x');

    expect((await source.finalIds()).trashed).toEqual(new Set());
    expect((await source.finalIds()).personal).toEqual(new Set());
  });
});
