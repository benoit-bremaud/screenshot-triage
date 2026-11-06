import { isAbsolute, join, relative, resolve as resolvePath, sep } from 'node:path';
import { parseArgs } from 'node:util';

import { EXIT_INTERNAL, EXIT_OK, EXIT_USAGE, UsageError, type CommandContext } from './commands/context.js';
import { doubt, file, resolve } from './commands/decide.js';
import { scan } from './commands/scan.js';
import { status, tags } from './commands/status.js';
import { LocalDirectorySource } from './sources/local-directory.js';
import { CaptureIndex } from './store/capture-index.js';
import { DecisionLog } from './store/decision-log.js';

/** The process boundary, injectable for tests. */
export interface CliIo {
  /** Read only by `file` and `doubt`, so the other commands never wait on a terminal. */
  readonly readStdin: () => Promise<string>;
  /** One line per call. */
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
  readonly now?: () => Date;
}

export const USAGE = [
  'usage: screenshot-triage <command> [options]',
  '  scan    --source <dir> [--dry-run]            copy new captures into data/inbox',
  '  file    <id> [--dry-run]                      decision JSON on stdin',
  '  doubt   <id> [--dry-run]                      doubt JSON on stdin',
  '  resolve <id> --as work|personal|delete [--source <dir>] [--dry-run]',
  '          (personal and delete need --source; work ignores --dry-run)',
  '  status  [--json]',
  '  tags',
  'options: --data <dir> (default ./data)  --knowledge <dir> (default ./knowledge)  --help',
  'exit codes: 0 done · 1 transition rejected · 2 usage · 3 unexpected error',
].join('\n');

/**
 * Parses argv, wires the adapters and runs one command. Returns the exit code: 0 done,
 * 1 rejected transition, 2 usage error, 3 unexpected error (message on stderr, no stack).
 */
export const runCli = async (argv: readonly string[], io: CliIo): Promise<number> => {
  try {
    return await dispatch(argv, io);
  } catch (error) {
    if (error instanceof UsageError || isParseArgsError(error)) {
      io.err(`usage error: ${error.message}`);
      io.err(USAGE);
      return EXIT_USAGE;
    }
    io.err(`error: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT_INTERNAL;
  }
};

const isParseArgsError = (error: unknown): error is Error =>
  error instanceof Error && 'code' in error && String(error.code).startsWith('ERR_PARSE_ARGS');

const dispatch = async (argv: readonly string[], io: CliIo): Promise<number> => {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      source: { type: 'string' },
      data: { type: 'string', default: './data' },
      knowledge: { type: 'string', default: './knowledge' },
      as: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  const [command, id] = positionals;
  if (values.help || command === undefined) {
    io.out(USAGE);
    return command === undefined && !values.help ? EXIT_USAGE : EXIT_OK;
  }
  if (values.source !== undefined) assertDisjoint(values.source, [values.data, values.knowledge]);
  const context: CommandContext = {
    dataDir: values.data,
    source: values.source === undefined ? undefined : new LocalDirectorySource(values.source),
    index: await CaptureIndex.load(join(values.data, 'index.jsonl')),
    log: new DecisionLog(join(values.knowledge, 'decisions.jsonl')),
    dryRun: values['dry-run'],
    now: io.now ?? (() => new Date()),
    out: io.out,
    err: io.err,
  };
  switch (command) {
    case 'scan':
      return scan(context);
    case 'file':
      return file(context, id, await io.readStdin());
    case 'doubt':
      return doubt(context, id, await io.readStdin());
    case 'resolve':
      return resolve(context, id, values.as);
    case 'status':
      return status(context, values.json);
    case 'tags':
      return tags(context);
    default:
      throw new UsageError(`unknown command: ${command}`);
  }
};

/** True when `inner` is `outer` or sits inside it. */
const within = (outer: string, inner: string): boolean => {
  const rel = relative(resolvePath(outer), resolvePath(inner));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

/** The source must not contain, or sit inside, the data or knowledge folders: a scan would eat its own copies. */
const assertDisjoint = (source: string, folders: readonly string[]): void => {
  if (folders.some((folder) => within(source, folder) || within(folder, source))) {
    throw new UsageError('--source must not contain or sit inside --data or --knowledge');
  }
};
