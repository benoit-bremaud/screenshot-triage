import { runEffects } from '../effects.js';
import { idOf } from '../triage/capture.js';
import { transition } from '../triage/transition.js';
import { EXIT_INTERNAL, EXIT_OK, requireSource, type CommandContext } from './context.js';

/**
 * `archive --source DIR [--dry-run]` (UC7, REQ-18, ADR-0004): every triaged capture, `other` included, and its
 * duplicates move into the source's private archive and become `archived`; the local copy stays. A failed one is
 * reported, keeps `triaged` with an error flag, and the run goes on; a re-run completes it. Prints
 * `{archived, failed, dryRun}`; exit 3 when any failed.
 */
export const archive = async (context: CommandContext): Promise<number> => {
  requireSource(context);
  const triaged = context.index.all().filter((row) => row.status === 'triaged');
  let archived = 0;
  const failed: string[] = [];
  // Sequential on purpose, like `purge`: a crash leaves at most one capture half-archived.
  for (const row of triaged) {
    const id = idOf(row.contentHash);
    const result = transition(row, { type: 'archive', duplicates: context.index.duplicatesOf(row.ref) });
    if (!result.ok) continue;
    try {
      await runEffects(result.effects, context);
      archived += 1;
    } catch (error) {
      failed.push(id);
      context.err(`archive of ${id} failed: ${error instanceof Error ? error.message : String(error)}`);
      // Best effort: the original error is the one reported.
      if (!context.dryRun) {
        await context.index.upsert({ ...row, error: 'archive failed' }).catch((flagError: unknown) => {
          context.err(`could not flag ${id}: ${flagError instanceof Error ? flagError.message : String(flagError)}`);
        });
      }
    }
  }
  context.out(JSON.stringify({ archived, failed, dryRun: context.dryRun }));
  return failed.length > 0 ? EXIT_INTERNAL : EXIT_OK;
};
