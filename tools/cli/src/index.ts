#!/usr/bin/env node
import { parseArgs } from './args';
import { runCli } from './commands';

const parsed = parseArgs(process.argv.slice(2));

const exitCode = runCli(
  {
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
  },
  { cwd: process.cwd(), env: process.env },
  parsed,
);

process.exitCode = exitCode;
