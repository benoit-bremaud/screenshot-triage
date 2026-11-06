import { mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';

import { exists, isMissing } from '../fs.js';
import { contentHashOf, isCaptureId, type SourceTarget } from '../triage/capture.js';
import type { CaptureSource, FinalIds, SourceCapture } from './capture-source.js';

export const PERSONAL_FOLDER = 'Personnel';
export const TRASH_FOLDER = '.trash';

/** Final folders hold `<id>.<ext>` names; anything else there is ignored. */
const idOfName = (fileName: string): string | undefined => {
  const id = fileName.split('.')[0] ?? '';
  return isCaptureId(id) ? id : undefined;
};

/**
 * Brick 2 source: a directory of screenshots. `Personnel/` and `.trash/` are the durable
 * record of final statuses, skipped by `listCaptures`, their content never read.
 */
export class LocalDirectorySource implements CaptureSource {
  constructor(private readonly root: string) {}

  async listCaptures(): Promise<readonly SourceCapture[]> {
    const captures: SourceCapture[] = [];
    await this.walk(this.root, captures);
    return captures.sort((a, b) => a.ref.localeCompare(b.ref));
  }

  private async walk(dir: string, into: SourceCapture[]): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        const top = dir === this.root && (entry.name === PERSONAL_FOLDER || entry.name === TRASH_FOLDER);
        if (!top) await this.walk(path, into);
        continue;
      }
      if (!entry.isFile()) continue;
      const info = await stat(path);
      into.push({
        ref: relative(this.root, path).split(sep).join('/'),
        name: entry.name,
        takenAt: info.mtime.toISOString(),
        size: info.size,
      });
    }
  }

  async read(ref: string): Promise<Uint8Array> {
    return readFile(this.resolve(ref));
  }

  async markPersonal(ref: string, target: SourceTarget): Promise<void> {
    await this.moveInto(PERSONAL_FOLDER, ref, target);
  }

  async trash(ref: string, target: SourceTarget): Promise<void> {
    await this.moveInto(TRASH_FOLDER, ref, target);
  }

  async finalIds(): Promise<FinalIds> {
    return {
      personal: await this.idsIn(PERSONAL_FOLDER),
      trashed: await this.idsIn(TRASH_FOLDER),
    };
  }

  /** Lists names only (ids), never bytes (REQ-5). */
  private async idsIn(folder: string): Promise<Set<string>> {
    try {
      const names = await readdir(join(this.root, folder));
      return new Set(names.map(idOfName).filter((id): id is string => id !== undefined));
    } catch (error) {
      if (isMissing(error)) return new Set();
      throw error;
    }
  }

  /**
   * Moves `ref` to `<folder>/<localName>`. A missing `ref` is already gone (deleted on the phone, or a
   * re-run after a crash): nothing to do. The CLI pins the source root, so a wrong `--source` never
   * gets here. A file whose size or time differ is hashed, never interpreted: same bytes, it is moved;
   * other bytes, the scanned capture is gone from that name and the file is left alone. When the
   * target exists the duplicate is removed instead, the bytes being identical.
   */
  private async moveInto(folder: string, ref: string, target: SourceTarget): Promise<void> {
    const from = this.resolve(ref);
    const destination = join(this.root, folder, target.localName);
    let info;
    try {
      info = await stat(from);
    } catch (error) {
      if (isMissing(error)) return;
      throw error;
    }
    const changed = info.size !== target.size || info.mtime.toISOString() !== target.takenAt;
    if (changed && contentHashOf(await readFile(from)) !== target.contentHash) return;
    await mkdir(join(this.root, folder), { recursive: true });
    if (await exists(destination)) {
      // The final folders are never read (REQ-5): their record is checked by size only before the copy goes.
      if ((await stat(destination)).size !== target.size) {
        throw new Error(`${folder}/${target.localName} holds other bytes; settle it by hand`);
      }
      await rm(from);
      return;
    }
    await rename(from, destination);
  }

  /** A ref is a path under the root (REQ-9): anything that escapes it is refused. */
  private resolve(ref: string): string {
    const path = join(this.root, ref);
    const inside = relative(this.root, path);
    if (inside === '' || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
      throw new Error('ref escapes the source directory');
    }
    return path;
  }
}
