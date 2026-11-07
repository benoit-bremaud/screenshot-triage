import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extractRun, png, triagedCapture, Workspace } from './helpers.js';

/** A real image sharp can decode, distinct per seed. */
const image = async (seed: number, format: 'png' | 'webp' = 'png'): Promise<Uint8Array> =>
  new Uint8Array(
    await sharp({ create: { width: 1200, height: 600, channels: 3, background: { r: seed, g: 10, b: 20 } } })
      .toFormat(format)
      .toBuffer(),
  );

describe('UC4 extract (T-16, T-18)', () => {
  let ws: Workspace;
  beforeEach(async () => {
    ws = await Workspace.create();
  });
  afterEach(() => ws.dispose());

  it('T-16: writes the sheet and moves triaged to extracted; a re-run rewrites it', async () => {
    const id = await triagedCapture(ws, 'a.png', png('a'));

    const first = await extractRun(ws, id);
    expect(first.code).toBe(0);
    expect((await ws.rowById(id))[0]?.status).toBe('extracted');
    const sheet = await readFile(join(ws.knowledge, 'frontend', `${id}.md`), 'utf8');
    expect(sheet).toContain(`- [${id}#1] verified (technical) Use useId for label and input pairing`);
    expect(sheet).toContain('tags: [react, hooks]');
    expect(sheet).not.toContain('a.png');

    const second = await extractRun(ws, id, { title: 'Corrected title' });
    expect(second.code).toBe(0);
    expect(await readFile(join(ws.knowledge, 'frontend', `${id}.md`), 'utf8')).toContain('# Corrected title');
  });

  it('T-16: rejected on an inbox capture and on the other domain, nothing written', async () => {
    const inbox = await ws.addCapture('i.png', png('i'));
    await ws.scan();
    expect((await extractRun(ws, inbox)).code).toBe(1);

    const other = await triagedCapture(ws, 'o.png', png('o'), 'other');
    expect((await extractRun(ws, other)).code).toBe(1);
    expect(await ws.list('knowledge', 'other')).toEqual([]);
    expect((await ws.rowById(other))[0]?.status).toBe('triaged');
  });

  it('T-16: an invalid payload leaves the row triaged and writes nothing', async () => {
    const id = await triagedCapture(ws, 'a.png', png('a'));

    const run = await extractRun(ws, id, { rules: [] });

    expect(run.code).toBe(2);
    expect((await ws.rowById(id))[0]?.status).toBe('triaged');
    expect(await ws.list('knowledge', 'frontend')).toEqual([]);
  });

  it('T-16: --dry-run prints the effects and changes nothing', async () => {
    const id = await triagedCapture(ws, 'a.png', png('a'));

    const run = await extractRun(ws, id, {}, ['--dry-run']);

    expect(run.out.filter((line) => line.startsWith('dry-run:'))).toHaveLength(3);
    expect((await ws.rowById(id))[0]?.status).toBe('triaged');
    expect(await ws.list('knowledge', 'frontend')).toEqual([]);
  });

  it('T-18: a design gem in png gets an 800 px JPEG thumbnail, removed when gem is dropped', async () => {
    const id = await triagedCapture(ws, 'g.png', await image(1), 'design');

    await extractRun(ws, id, { gem: true, rules: [{ rank: 1, text: 'Tight leading on display type', kind: 'design', status: 'consistent' }] });
    const meta = await sharp(join(ws.data, 'thumbnails', `${id}.jpg`)).metadata();
    expect(meta).toMatchObject({ format: 'jpeg', width: 800 });

    await extractRun(ws, id, { rules: [{ rank: 1, text: 'Tight leading on display type', kind: 'design', status: 'consistent' }] });
    expect(await ws.exists('data', 'thumbnails', `${id}.jpg`)).toBe(false);
  });

  it('T-18: an undecodable design gem still lands, reported without thumbnail', async () => {
    const id = await triagedCapture(ws, 'bad.png', png('truncated'), 'design');
    const design = [{ rank: 1, text: 'Tight leading', kind: 'design', status: 'consistent' }];

    const run = await extractRun(ws, id, { gem: true, rules: design });

    expect(run.code).toBe(0);
    expect(run.json()).toMatchObject({ status: 'extracted', thumbnail: null });
    expect(await ws.list('data', 'thumbnails')).toEqual([]);
  });

  it('T-18: a gem outside design is reported without thumbnail', async () => {
    const id = await triagedCapture(ws, 'f.png', png('f'));

    expect((await extractRun(ws, id, { gem: true })).json()).toMatchObject({ thumbnail: null, gemWithoutThumbnail: true });
  });

  it('T-18: no thumbnail for a gem outside design', async () => {
    const id = await triagedCapture(ws, 'w.webp', await image(2, 'webp'), 'frontend');

    await extractRun(ws, id, { gem: true });

    expect(await ws.list('data', 'thumbnails')).toEqual([]);
  });
});
