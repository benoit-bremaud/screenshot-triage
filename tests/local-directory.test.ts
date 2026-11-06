import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises';
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
    target = {
      localName: 'abcdef012345.png',
      contentHash: createHash('sha256').update('bytes').digest('hex'),
      size: info.size,
      takenAt: info.mtime.toISOString(),
    };
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

  it('a ref deleted on the phone is already gone: nothing to do', async () => {
    await rm(join(root, 'a.png'));

    await expect(source.trash('a.png', target)).resolves.toBeUndefined();
  });

  it('leaves alone a reused name holding other bytes, and the call completes', async () => {
    await writeFile(join(root, 'a.png'), 'other bytes');

    await source.markPersonal('a.png', target);

    expect(await readFile(join(root, 'a.png'), 'utf8')).toBe('other bytes');
    expect((await source.finalIds()).personal).toEqual(new Set());
  });

  it('moves a touched file whose bytes are the scanned ones', async () => {
    const later = new Date('2027-01-01T00:00:00Z');
    await utimes(join(root, 'a.png'), later, later);

    await source.trash('a.png', target);

    expect((await source.finalIds()).trashed).toEqual(new Set(['abcdef012345']));
  });

  it('keeps the source copy when the final record is a symbolic link', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'outside-'));
    await writeFile(join(outside, 'record.png'), 'bytes');
    await mkdir(join(root, '.trash'));
    await symlink(join(outside, 'record.png'), join(root, '.trash', target.localName));

    await expect(source.trash('a.png', target)).rejects.toThrow('holds other bytes');
    expect(await readFile(join(root, 'a.png'), 'utf8')).toBe('bytes');
    await rm(outside, { recursive: true, force: true });
  });

  it('keeps the source copy when the final record holds other bytes', async () => {
    await mkdir(join(root, '.trash'));
    await writeFile(join(root, '.trash', target.localName), 'corrupted');

    await expect(source.trash('a.png', target)).rejects.toThrow('holds other bytes');
    expect(await readFile(join(root, 'a.png'), 'utf8')).toBe('bytes');
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

  it('refuses a final folder that is a symbolic link', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'outside-'));
    await symlink(outside, join(root, 'Personnel'));

    await expect(source.markPersonal('a.png', target)).rejects.toThrow('real directory');
    await expect(source.finalIds()).rejects.toThrow('real directory');
    expect(await readFile(join(root, 'a.png'), 'utf8')).toBe('bytes');
    await rm(outside, { recursive: true, force: true });
  });

  it('lists ids only from the final folders, ignoring foreign names', async () => {
    await mkdir(join(root, '.trash'));
    await writeFile(join(root, '.trash', 'notes.txt'), 'x');
    for (const name of ['0123456789ab', '0123456789ab.txt', '0123456789ab.png.bak']) {
      await writeFile(join(root, '.trash', name), 'x');
    }
    await mkdir(join(root, 'Personnel'));
    await writeFile(join(root, 'Personnel', 'ba9876543210.heic'), 'x');

    expect((await source.finalIds()).trashed).toEqual(new Set());
    expect((await source.finalIds()).personal).toEqual(new Set(['ba9876543210']));
  });
});
