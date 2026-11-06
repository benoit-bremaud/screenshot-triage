import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve as resolvePath, sep } from 'node:path';
import { parseArgs } from 'node:util';

import { EXIT_INTERNAL, EXIT_OK, EXIT_USAGE, UsageError, type CommandContext } from './commands/context.js';
import { doubt, file, resolve } from './commands/decide.js';
import { scan } from './commands/scan.js';
import { status, tags } from './commands/status.js';
import { isMissing } from './fs.js';
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
  const [command, id, ...extra] = positionals;
  if (extra.length > 0) throw new UsageError(`unexpected argument: ${extra.join(' ')}`);
  if (values.help || command === undefined) {
    io.out(USAGE);
    return command === undefined && !values.help ? EXIT_USAGE : EXIT_OK;
  }
  if (values.source !== undefined) {
    await assertDisjoint(values.source, [values.data, values.knowledge]);
    await pinSource(values.source, values.data, values['dry-run']);
  }
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

/**
 * The first `--source` used with a data folder is recorded in `data/source.json` (its real path); any
 * other is refused, so a source call never acts on a same-named file of another directory.
 */
const pinSource = async (source: string, dataDir: string, dryRun: boolean): Promise<void> => {
  const root = await realpath(source).catch(() => {
    throw new UsageError('--source must be an existing directory');
  });
  const record = join(dataDir, 'source.json');
  let pinned: string | undefined;
  try {
    pinned = (JSON.parse(await readFile(record, 'utf8')) as { root?: string }).root;
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  if (pinned !== undefined && pinned !== root) {
    throw new UsageError(
      `--source differs from the pinned source ${pinned}; if the folder moved, edit ${record} by hand (never point it at another folder)`,
    );
  }
  if (pinned === undefined && !dryRun) {
    await mkdir(dataDir, { recursive: true });
    await writeFile(record, `${JSON.stringify({ root })}\n`, 'utf8');
  }
};

/** Real path of `path`, symbolic links followed; a missing tail is appended to its nearest existing ancestor. */
const canonical = async (path: string): Promise<string> => {
  const absolute = resolvePath(path);
  try {
    return await realpath(absolute);
  } catch (error) {
    const parent = dirname(absolute);
    if (!isMissing(error) || parent === absolute) throw error;
    return join(await canonical(parent), basename(absolute));
  }
};

/** True when `inner` is `outer` or sits inside it; both are canonical paths. */
const within = (outer: string, inner: string): boolean => {
  const rel = relative(outer, inner);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

/** The source must not contain, or sit inside, the data or knowledge folders: a scan would eat its own copies. */
const assertDisjoint = async (source: string, folders: readonly string[]): Promise<void> => {
  const root = await canonical(source);
  for (const folder of folders) {
    const path = await canonical(folder);
    if (within(root, path) || within(path, root)) {
      throw new UsageError('--source must not contain or sit inside --data or --knowledge');
    }
  }
};
