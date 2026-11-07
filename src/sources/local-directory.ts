import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';

import { isMissing } from '../fs.js';
import { contentHashOf, isCaptureId, type SourceTarget } from '../triage/capture.js';
import { IMAGE_EXTENSIONS } from '../triage/image.js';
import type { CaptureSource, FinalIds, SourceCapture } from './capture-source.js';

export const PERSONAL_FOLDER = 'Personnel';
export const TRASH_FOLDER = '.trash';

/** Final folders hold `<id>.<ext>` names with a whitelisted image extension; anything else there is ignored. */
const idOfName = (fileName: string): string | undefined => {
  const [id = '', ext, ...rest] = fileName.split('.');
  const image = (IMAGE_EXTENSIONS as readonly string[]).includes(ext ?? '');
  return image && rest.length === 0 && isCaptureId(id) ? id : undefined;
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

  /** Never follows a symbolic link put in place of the listed file after the listing. */
  async read(ref: string): Promise<Uint8Array> {
    const handle = await open(this.resolve(ref), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      return await handle.readFile();
    } finally {
      await handle.close();
    }
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
      // Only regular files are records: a link, a folder or a device of the same name is not.
      const entries = await readdir(await this.finalFolder(folder), { withFileTypes: true });
      const names = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
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
    const destination = join(await this.finalFolder(folder), target.localName);
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
    const record = await lstat(destination).catch((error: unknown) => {
      if (isMissing(error)) return undefined;
      throw error;
    });
    if (record !== undefined) {
      // The final folders are never read (REQ-5): their record, a regular file never a link, is checked
      // by size only before the copy goes.
      if (!record.isFile() || record.size !== target.size) {
        throw new Error(`${folder}/${target.localName} holds other bytes; settle it by hand`);
      }
      await rm(from);
      return;
    }
    await rename(from, destination);
  }

  /**
   * A final folder is a real directory right under the root, never a symbolic link: a link would move
   * captures, or read ids, outside the pinned source.
   */
  private async finalFolder(folder: string): Promise<string> {
    const path = join(this.root, folder);
    try {
      const info = await lstat(path);
      if (!info.isDirectory()) throw new Error(`${folder} must be a real directory inside the source`);
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    return path;
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
