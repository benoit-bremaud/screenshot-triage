import sharp from 'sharp';

/** Width of a design gem thumbnail (ADR-0001 decision 7, REQ-13). */
export const THUMBNAIL_WIDTH = 800;

/** Writes an 800 px wide JPEG of `input` to `output`; metadata is stripped by default. */
export const writeThumbnail = async (input: string, output: string): Promise<void> => {
  await sharp(input).resize({ width: THUMBNAIL_WIDTH }).jpeg().toFile(output);
};
