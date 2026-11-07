/**
 * Image type from the magic bytes against a whitelist (ADR-0002 § Consequences).
 * The extension of a local copy never comes from the source filename.
 */
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'webp', 'heic'] as const;

/** A whitelisted image extension, from the magic bytes. */
export type ImageExt = (typeof IMAGE_EXTENSIONS)[number];

const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

const startsWith = (bytes: Uint8Array, offset: number, expected: readonly number[]): boolean =>
  expected.every((byte, index) => bytes[offset + index] === byte);

const ascii = (bytes: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

/** Returns the whitelisted extension, or undefined when the bytes are not an accepted image. */
export const detectImageExt = (bytes: Uint8Array): ImageExt | undefined => {
  if (bytes.length < 12) return undefined;
  if (startsWith(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, 0, [0xff, 0xd8, 0xff])) return 'jpg';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
  if (ascii(bytes, 4, 4) === 'ftyp' && HEIF_BRANDS.has(ascii(bytes, 8, 4))) return 'heic';
  return undefined;
};
