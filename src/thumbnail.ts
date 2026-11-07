import sharp from 'sharp';

/** Width of a design gem thumbnail (ADR-0001 decision 7, REQ-13). */
export const THUMBNAIL_WIDTH = 800;

/**
 * Decodes `input` into an 800 px wide JPEG; metadata is stripped by default. It only decodes: the caller
 * writes the bytes, so a decode failure and a file-system failure stay distinguishable.
 */
export const renderThumbnail = async (input: string): Promise<Buffer> =>
  sharp(input).resize({ width: THUMBNAIL_WIDTH }).jpeg().toBuffer();
