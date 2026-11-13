import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve as resolvePath, sep } from 'node:path';
import { parseArgs } from 'node:util';

import { EXIT_INTERNAL, EXIT_OK, EXIT_USAGE, messageOf, UsageError, type CommandContext } from './commands/context.js';
import { archive } from './commands/archive.js';
import { doubt, file, resolve } from './commands/decide.js';
import { extract, notes, purge } from './commands/extract.js';
import { scan } from './commands/scan.js';
import { status, tags } from './commands/status.js';
import { isMissing } from './fs.js';
import { isCaptureId } from './triage/capture.js';
import { isAnswer } from './triage/status.js';
import { LocalDirectorySource } from './sources/local-directory.js';
import { CaptureIndex } from './store/capture-index.js';
import { DecisionLog } from './store/decision-log.js';

/** The process boundary, injectable for tests. */
export interface CliIo {
  /** Read only by `file`, `doubt` and `extract`, so the other commands never wait on a terminal. */
  readonly readStdin: () => Promise<string>;
  /** One line per call. */
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
  readonly now?: () => Date;
}

/** The help text printed by `--help` and after a usage error. */
export const USAGE = [
  'usage: screenshot-triage <command> [options]',
  '  scan    --source <dir> [--dry-run]            copy new captures into data/inbox',
  '  file    <id> [--dry-run]                      decision JSON on stdin',
  '  doubt   <id> [--dry-run]                      doubt JSON on stdin',
  '  resolve <id> --as work|personal|delete [--source <dir>] [--dry-run]',
  '          (personal and delete need --source; work ignores --dry-run; triaged or archived: personal or delete)',
  '  extract <id> [--dry-run]                      sheet JSON on stdin',
  '  purge   --source <dir> [--dry-run]            delete the extracted captures and their duplicates',
  '  archive --source <dir> [--dry-run]            move the triaged captures and their duplicates to .archive/',
  '  notes   --skills-dir <dir>                    uncited rules per target skill, from origin/main',
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
    io.err(`error: ${messageOf(error)}`);
    return EXIT_INTERNAL;
  }
};

const isParseArgsError = (error: unknown): error is Error =>
  error instanceof Error && 'code' in error && String(error.code).startsWith('ERR_PARSE_ARGS');

/** Commands that take a capture id; the others take no positional argument. */
const ID_COMMANDS: ReadonlySet<string> = new Set(['file', 'doubt', 'resolve', 'extract']);
const COMMANDS: ReadonlySet<string> = new Set([...ID_COMMANDS, 'scan', 'purge', 'archive', 'notes', 'status', 'tags']);

const dispatch = async (argv: readonly string[], io: CliIo): Promise<number> => {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      source: { type: 'string' },
      data: { type: 'string', default: './data' },
      knowledge: { type: 'string', default: './knowledge' },
      as: { type: 'string' },
      'skills-dir': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  const [command, id, ...extra] = positionals;
  if (values.help || command === undefined) {
    io.out(USAGE);
    return command === undefined && !values.help ? EXIT_USAGE : EXIT_OK;
  }
  // Every argv check runs before the first persistent side effect, the source pin; a stdin payload
  // is read only by `file`, `doubt` and `extract`, which never pin.
  if (!COMMANDS.has(command)) throw new UsageError(`unknown command: ${command}`);
  const unexpected = ID_COMMANDS.has(command) ? extra : [id, ...extra].filter((arg) => arg !== undefined);
  if (unexpected.length > 0) throw new UsageError(`unexpected argument: ${unexpected.join(' ')}`);
  if (ID_COMMANDS.has(command) && (id === undefined || !isCaptureId(id))) {
    throw new UsageError('expected a capture id: 12 hex characters, never a filename or a ref');
  }
  if (command === 'resolve' && (values.as === undefined || !isAnswer(values.as))) {
    throw new UsageError('--as must be work, personal or delete');
  }
  // `data/` is private and `knowledge/` is published: neither may hold the other.
  if (await overlaps(values.data, values.knowledge)) {
    throw new UsageError('--data and --knowledge must not contain each other');
  }
  if (values.source !== undefined) await assertDisjoint(values.source, [values.data, values.knowledge]);
  const index = await CaptureIndex.load(join(values.data, 'index.jsonl'));
  // Only a command that will act on the source pins it: `scan`, `purge`, `archive`, and `resolve personal|delete` on a
  // doubtful, triaged or archived capture. A mistyped --source on any other command, or a rejected resolve, locks nothing.
  const resolvable = ['doubtful', 'triaged', 'archived'].includes(index.forCommand(id ?? '')?.status ?? '');
  const actsOnSource =
    command === 'scan' || command === 'purge' || command === 'archive' || (command === 'resolve' && values.as !== 'work' && resolvable);
  if (values.source !== undefined && actsOnSource) await pinSource(values.source, values.data, values['dry-run']);
  const context: CommandContext = {
    dataDir: values.data,
    knowledgeDir: values.knowledge,
    source: values.source === undefined ? undefined : new LocalDirectorySource(values.source),
    index,
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
    case 'extract':
      return extract(context, id, await io.readStdin());
    case 'purge':
      return purge(context);
    case 'archive':
      return archive(context);
    case 'notes':
      return notes(context, values['skills-dir']);
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
  const root = await realpath(source).catch(() => '');
  if (root === '' || !(await stat(root)).isDirectory()) throw new UsageError('--source must be an existing directory');
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

/** True when either folder is the other or sits inside it, symbolic links followed. */
const overlaps = async (a: string, b: string): Promise<boolean> => {
  const [first, second] = [await canonical(a), await canonical(b)];
  return within(first, second) || within(second, first);
};

/** The source must not contain, or sit inside, the data or knowledge folders: a scan would eat its own copies. */
const assertDisjoint = async (source: string, folders: readonly string[]): Promise<void> => {
  for (const folder of folders) {
    if (await overlaps(source, folder)) {
      throw new UsageError('--source must not contain or sit inside --data or --knowledge');
    }
  }
};
