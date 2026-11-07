import { runEffects } from '../effects.js';
import { contentHashOf, idOf } from '../triage/capture.js';
import { detectImageExt } from '../triage/image.js';
import type { Status } from '../triage/status.js';
import { scanRevisits, transition, type ScanCandidate } from '../triage/transition.js';
import { EXIT_OK, entryOf, requireSource, type CaptureEntry, type CommandContext } from './context.js';

/** What `scan` prints: the inbox entries for the skill and the counts of the other guards. */
export interface ScanReport {
  /** Every capture awaiting a decision, new or not. */
  readonly inbox: readonly CaptureEntry[];
  /** Candidates whose bytes are not a whitelisted image; reported on every scan (UC1 ext. 2b). */
  readonly rejected: number;
  /** Candidates whose id matches a different hash already indexed; nothing is written for them. */
  readonly collisions: number;
  /** Candidates whose file changed between the listing and the read; the next scan takes them. */
  readonly changed: number;
  /** Rows written by this scan, per status. */
  readonly seen: Partial<Record<Status, number>>;
}

/**
 * UC1 step 2 (SEQ-triage-batch): lists the source, hashes every new capture (or one whose ref
 * came back after a final status), runs the four guards and copies the inbox ones into
 * `data/inbox/<id>.<ext>`. Prints a JSON `ScanReport`. With `--dry-run` nothing is written.
 */
export const scan = async (context: CommandContext): Promise<number> => {
  const source = requireSource(context);
  const finalIds = await source.finalIds();
  const seen: Partial<Record<Status, number>> = {};
  let rejected = 0;
  let collisions = 0;
  let changed = 0;
  for (const capture of await source.listCaptures()) {
    const existing = context.index.byRef(capture.ref);
    if (!scanRevisits(existing)) continue;
    const bytes = await source.read(capture.ref);
    // Replaced between the listing and the read: the metadata would describe other bytes. Next scan.
    if (bytes.length !== capture.size) {
      changed += 1;
      continue;
    }
    const ext = detectImageExt(bytes);
    if (ext === undefined) {
      rejected += 1;
      continue;
    }
    const contentHash = contentHashOf(bytes);
    const id = idOf(contentHash);
    if (context.index.latestById(id) !== undefined && context.index.byHash(contentHash).length === 0) {
      collisions += 1;
      continue;
    }
    const candidate: ScanCandidate = { ...capture, contentHash, ext };
    const result = transition(existing, {
      type: 'scan',
      candidate,
      facts: {
        sameHash: context.index.byHash(contentHash),
        personalAtSource: finalIds.personal.has(id),
        trashedAtSource: finalIds.trashed.has(id),
      },
    });
    // `scanRevisits` is the guard `transition` applies: a rejection here cannot happen.
    if (!result.ok) throw new Error(result.reason);
    await runEffects(result.effects, context);
    seen[result.next] = (seen[result.next] ?? 0) + 1;
  }
  const inbox: CaptureEntry[] = [];
  for (const row of context.index.all()) {
    if (row.status === 'inbox') inbox.push(await entryOf(context, row));
  }
  const report: ScanReport = { inbox, rejected, collisions, changed, seen };
  context.out(JSON.stringify(report));
  return EXIT_OK;
};
