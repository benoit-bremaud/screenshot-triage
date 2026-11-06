import type { CaptureRow } from './capture.js';
import type { DecisionLine } from './decision.js';
import type { Domain } from './domains.js';

/**
 * The effects a transition asks for, in execution order. `src/effects.ts` runs them;
 * with `--dry-run` it prints them (REQ-6). Local files are always addressed by `<id>.<ext>`.
 */
export type Effect =
  | { readonly kind: 'copy-to-inbox'; readonly ref: string; readonly localName: string }
  | { readonly kind: 'move-to-domain'; readonly localName: string; readonly domain: Domain }
  | { readonly kind: 'delete-local'; readonly localName: string }
  | { readonly kind: 'source-mark-personal'; readonly ref: string; readonly localName: string }
  | { readonly kind: 'source-trash'; readonly ref: string; readonly localName: string }
  | { readonly kind: 'log-append'; readonly line: DecisionLine }
  | { readonly kind: 'index-write'; readonly row: CaptureRow };

/** One line per effect for `--dry-run`: ids only, never a ref (REQ-5, REQ-9). */
export const describeEffect = (effect: Effect): string => {
  switch (effect.kind) {
    case 'copy-to-inbox':
      return `copy source capture to data/inbox/${effect.localName}`;
    case 'move-to-domain':
      return `move ${effect.localName} to data/${effect.domain}/`;
    case 'delete-local':
      return `delete local ${effect.localName}`;
    case 'source-mark-personal':
      return `source.markPersonal(${effect.localName})`;
    case 'source-trash':
      return `source.trash(${effect.localName})`;
    case 'log-append':
      return `append decision for ${effect.line.contentHash.slice(0, 12)} (${effect.line.domain})`;
    case 'index-write':
      return `index: ${effect.row.contentHash.slice(0, 12)} -> ${effect.row.status}`;
  }
};
