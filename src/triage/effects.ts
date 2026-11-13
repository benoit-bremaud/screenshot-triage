import { idOf, type CaptureRow, type SourceTarget } from './capture.js';
import type { DecisionLine } from './decision.js';
import type { Domain } from './domains.js';

/**
 * The effects a transition asks for, in execution order. `src/effects.ts` runs them;
 * with `--dry-run` it prints them (REQ-6). Local files are always addressed by `<id>.<ext>`.
 */
export type Effect =
  | { readonly kind: 'copy-to-inbox'; readonly ref: string; readonly localName: string; readonly contentHash: string }
  | { readonly kind: 'move-to-domain'; readonly localName: string; readonly domain: Domain }
  | { readonly kind: 'delete-local'; readonly localName: string }
  | { readonly kind: 'source-mark-personal'; readonly ref: string; readonly target: SourceTarget }
  | { readonly kind: 'source-trash'; readonly ref: string; readonly target: SourceTarget }
  | { readonly kind: 'source-archive'; readonly ref: string; readonly target: SourceTarget }
  | { readonly kind: 'log-append'; readonly line: DecisionLine }
  | { readonly kind: 'index-write'; readonly row: CaptureRow }
  | { readonly kind: 'write-sheet'; readonly id: string; readonly domain: Domain; readonly markdown: string }
  | { readonly kind: 'write-thumbnail'; readonly id: string; readonly localName: string }
  | { readonly kind: 'remove-thumbnail'; readonly id: string }
  | { readonly kind: 'remove-sheet'; readonly id: string; readonly domain: Domain };

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
      return `source.markPersonal(${effect.target.localName})`;
    case 'source-trash':
      return `source.trash(${effect.target.localName})`;
    case 'source-archive':
      return `source.archive(${effect.target.localName})`;
    case 'log-append':
      return `append decision for ${idOf(effect.line.contentHash)} (${effect.line.domain})`;
    case 'index-write':
      return `index: ${idOf(effect.row.contentHash)} -> ${effect.row.status}`;
    case 'write-sheet':
      return `write sheet knowledge/${effect.domain}/${effect.id}.md`;
    case 'write-thumbnail':
      return `write thumbnail data/thumbnails/${effect.id}.jpg`;
    case 'remove-sheet':
      return `remove sheet knowledge/${effect.domain}/${effect.id}.md if present`;
    case 'remove-thumbnail':
      return `remove thumbnail data/thumbnails/${effect.id}.jpg if present`;
  }
};
