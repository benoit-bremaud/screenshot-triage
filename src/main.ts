#!/usr/bin/env node
import { text } from 'node:stream/consumers';

import { runCli } from './cli.js';

process.exitCode = await runCli(process.argv.slice(2), {
  readStdin: () => text(process.stdin),
  out: (line) => {
    process.stdout.write(`${line}\n`);
  },
  err: (line) => {
    process.stderr.write(`${line}\n`);
  },
});
