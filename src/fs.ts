import { stat } from 'node:fs/promises';

/** True for the ENOENT error of `node:fs`. */
export const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

/** True for the EEXIST error of `node:fs`. */
export const isExisting = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';

/** True when a path exists, whatever its kind. */
export const exists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
};
