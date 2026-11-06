import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { EXIT_OK, EXIT_USAGE, UsageError, type CommandContext } from './commands/context.js';
import { doubt, file, resolve } from './commands/decide.js';
import { scan } from './commands/scan.js';
import { status, tags } from './commands/status.js';
import { LocalDirectorySource } from './sources/local-directory.js';
import { CaptureIndex } from './store/capture-index.js';
import { DecisionLog } from './store/decision-log.js';

export interface CliIo {
  readonly stdin: string;
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
  readonly now?: () => Date;
}

export const USAGE = [
  'usage: screenshot-triage <command> [options]',
  '  scan    --source <dir> [--dry-run]            copy new captures into data/inbox',
  '  file    <id>                                  decision JSON on stdin',
  '  doubt   <id>                                  doubt JSON on stdin',
  '  resolve <id> --as work|personal|delete --source <dir> [--dry-run]',
  '  status  [--json]',
  '  tags',
  'options: --data <dir> (default ./data)  --knowledge <dir> (default ./knowledge)',
].join('\n');

/** The composition root (03-component): parses argv and stdin, wires the adapters, runs one command. */
export const runCli = async (argv: readonly string[], io: CliIo): Promise<number> => {
  try {
    return await dispatch(argv, io);
  } catch (error) {
    if (error instanceof UsageError) {
      io.err(`usage error: ${error.message}`);
      io.err(USAGE);
      return EXIT_USAGE;
    }
    throw error;
  }
};

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
      return file(context, id, io.stdin);
    case 'doubt':
      return doubt(context, id, io.stdin);
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
