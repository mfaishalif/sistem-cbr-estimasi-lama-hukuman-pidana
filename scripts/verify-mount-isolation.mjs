#!/usr/bin/env node
/**
 * Verify that the evaluation container does not mount or write the
 * application database. Requires the app service to have been created:
 *
 *   docker compose up -d --build
 *   node scripts/verify-mount-isolation.mjs
 *
 * The app is stopped while the hashes are taken so SQLite WAL checkpointing
 * cannot make an idle database look modified. It is started again afterwards.
 */
import { spawnSync } from 'node:child_process';

function docker(args, { capture = false } = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Command failed (${result.status}): docker ${args.join(' ')}\n${result.stderr ?? ''}`,
    );
  }
  return result.stdout ?? '';
}

function appDataHash() {
  // Hash the database plus any WAL/SHM files that exist.
  const output = docker(
    [
      'compose',
      'run',
      '--rm',
      '--no-deps',
      '-T',
      '--entrypoint',
      'sh',
      'app',
      '-c',
      'sha256sum /data/app.db* 2>/dev/null',
    ],
    { capture: true },
  );

  return output
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .sort()
    .join('\n');
}

let before;
let after;
let probe;

docker(['compose', 'stop', 'app'], { capture: true });
try {
  before = appDataHash();
  console.log(`Application data hash before evaluation:\n${before}`);

  probe = docker(
    [
      'compose',
      '--profile',
      'tools',
      'run',
      '--rm',
      '--no-deps',
      '-T',
      '--entrypoint',
      'sh',
      'evaluate',
      '-c',
      'if [ -e /data/app.db ]; then echo "app database is mounted in evaluate" >&2; exit 1; fi; node tools/cli/dist/index.js evaluate --workspace /workspace --artifacts /artifacts',
    ],
    { capture: true },
  );

  after = appDataHash();
  console.log(`Application data hash after evaluation:\n${after}`);
} finally {
  docker(['compose', 'start', 'app'], { capture: true });
}

console.log(probe.trim());

if (before !== after) {
  console.error('FAIL: evaluation changed the application database');
  process.exit(1);
}

console.log('OK: evaluation has no application database mount and did not change it.');
