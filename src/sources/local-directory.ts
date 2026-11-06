import { mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import type { CaptureSource, FinalIds, SourceCapture } from './capture-source.js';

export const PERSONAL_FOLDER = 'Personnel';
export const TRASH_FOLDER = '.trash';

const idOfName = (fileName: string): string => fileName.split('.')[0] ?? '';

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
      });
    }
  }

  read(ref: string): Promise<Uint8Array> {
    return readFile(this.resolve(ref));
  }

  markPersonal(ref: string, localName: string): Promise<void> {
    return this.moveInto(PERSONAL_FOLDER, ref, localName);
  }

  trash(ref: string, localName: string): Promise<void> {
    return this.moveInto(TRASH_FOLDER, ref, localName);
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
      return new Set(names.map(idOfName));
    } catch (error) {
      if (isMissing(error)) return new Set();
      throw error;
    }
  }

  /** A duplicate whose target name exists is removed instead of moved: the bytes are identical. */
  private async moveInto(folder: string, ref: string, localName: string): Promise<void> {
    const from = this.resolve(ref);
    const target = join(this.root, folder, localName);
    await mkdir(join(this.root, folder), { recursive: true });
    if (await exists(target)) {
      await rm(from);
      return;
    }
    await rename(from, target);
  }

  private resolve(ref: string): string {
    const path = join(this.root, ref);
    const inside = relative(this.root, path);
    if (inside.startsWith('..') || inside === '') throw new Error('ref escapes the source directory');
    return path;
  }
}

const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

const exists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
};
