#!/usr/bin/env node
import { text } from 'node:stream/consumers';

import { runCli } from './cli.js';

const needsStdin = process.argv[2] === 'file' || process.argv[2] === 'doubt';
const stdin = needsStdin ? await text(process.stdin) : '';
process.exitCode = await runCli(process.argv.slice(2), {
  stdin,
  out: (line) => {
    process.stdout.write(`${line}\n`);
  },
  err: (line) => {
    process.stderr.write(`${line}\n`);
  },
});
