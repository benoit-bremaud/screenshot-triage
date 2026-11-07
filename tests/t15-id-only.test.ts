import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ScanReport } from '../src/commands/scan.js';
import { detectImageExt } from '../src/triage/image.js';
import { jpg, png, Workspace } from './helpers.js';

describe('T-15 commands take an id, local copies are named by id, hostile bytes never reach a path', () => {
  let ws: Workspace;
  beforeEach(async () => {
    ws = await Workspace.create();
  });
  afterEach(() => ws.dispose());

  it('rejects a ref, a filename or a path on argv with exit 2', async () => {
    await ws.addCapture('a.png', png('one'));
    await ws.scan();
    for (const bad of ['a.png', '../a.png', 'data/inbox/x.png', 'ABCDEF012345', 'abc', undefined]) {
      const args = bad === undefined ? ['file'] : ['file', bad];
      const run = await ws.run(args, '{}');
      expect(run.code, String(bad)).toBe(2);
      expect(run.err[0]).toContain('expected a capture id');
    }
  });

  it('names the copy by id with the extension from the magic bytes, not the filename', async () => {
    const id = await ws.addCapture('evil.png.sh', jpg('x'));
    const run = await ws.scan();
    expect(await ws.list('data', 'inbox')).toEqual([`${id}.jpg`]);
    expect(run.json<ScanReport>().inbox[0]?.path).not.toContain('evil');
  });

  it('rejects non-image bytes on every scan and records nothing about them', async () => {
    await ws.addCapture('script.png', Buffer.from('#!/bin/sh\nrm -rf /\n'));
    await ws.addCapture('tiny.jpg', Uint8Array.from([0xff, 0xd8]));
    const first = await ws.scan();
    expect(first.json<ScanReport>().rejected).toBe(2);
    expect(await ws.index()).toEqual([]);
    expect(await ws.list('data', 'inbox')).toEqual([]);
    const second = await ws.scan();
    expect(second.json<ScanReport>().rejected).toBe(2);
  });

  it('detects the four whitelisted formats and nothing else', () => {
    expect(detectImageExt(png('a'))).toBe('png');
    expect(detectImageExt(jpg('a'))).toBe('jpg');
    const webp = Uint8Array.from([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBPVP8 ')]);
    expect(detectImageExt(webp)).toBe('webp');
    const heic = Uint8Array.from([0, 0, 0, 0x18, ...Buffer.from('ftypheic'), 0, 0, 0, 0]);
    expect(detectImageExt(heic)).toBe('heic');
    const gif = Uint8Array.from([...Buffer.from('GIF89a'), 0, 0, 0, 0, 0, 0, 0]);
    expect(detectImageExt(gif)).toBeUndefined();
    expect(detectImageExt(Uint8Array.from([0, 0, 0, 0x18, ...Buffer.from('ftypmp42'), 0, 0, 0, 0]))).toBeUndefined();
  });
});
