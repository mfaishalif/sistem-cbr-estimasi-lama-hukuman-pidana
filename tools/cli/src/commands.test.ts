import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseArgs } from './args';
import { runCli, type CliEnvironment } from './commands';

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cbr-cli-'));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

function run(argv: string[], environment?: Partial<CliEnvironment>) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = runCli(
    { stdout: (line) => stdout.push(line), stderr: (line) => stderr.push(line) },
    { cwd: directory, env: {}, ...environment },
    parseArgs(argv),
  );

  return { code, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
}

describe('parseArgs', () => {
  it('separates the command, positionals, and flag values', () => {
    expect(parseArgs(['migrate', '--database', 'a.db', '--flag', '--x=1', 'extra'])).toEqual({
      command: 'migrate',
      positionals: ['extra'],
      flags: { database: 'a.db', flag: 'true', x: '1' },
    });
  });
});

describe('cli', () => {
  it('migrates and reports status', () => {
    const database = join(directory, 'app.db');

    const migrate = run(['migrate', '--database', database]);
    expect(migrate.code).toBe(0);
    expect(JSON.parse(migrate.stdout)).toMatchObject({
      database,
      applied: ['001'],
      schemaVersion: '001',
    });
    expect(existsSync(database)).toBe(true);

    const status = run(['status', '--database', database]);
    expect(status.code).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({
      database,
      exists: true,
      schemaVersion: '001',
      caseUnits: 0,
      caseGroups: 0,
      generation: 0,
    });
  });

  it('reports a missing database without creating it', () => {
    const database = join(directory, 'missing.db');
    const status = run(['status', '--database', database]);

    expect(status.code).toBe(0);
    expect(JSON.parse(status.stdout)).toEqual({ database, exists: false });
    expect(existsSync(database)).toBe(false);
  });

  it('creates a case unit from a JSON file', () => {
    const database = join(directory, 'app.db');
    const file = join(directory, 'case.json');
    writeFileSync(
      file,
      JSON.stringify({
        court: 'PN Jakarta Pusat',
        caseNumber: '1/Pid.B/2024/PN Jkt.Pst',
        narration: 'Narasi sintetis untuk pemeriksaan persistensi.',
        actualSentenceDays: 180,
      }),
      'utf8',
    );

    const created = run(['create-case', '--database', database, '--file', file]);
    expect(created.code).toBe(0);
    expect(JSON.parse(created.stdout)).toMatchObject({
      database,
      generation: 1,
    });

    const status = run(['status', '--database', database]);
    expect(JSON.parse(status.stdout)).toMatchObject({ caseUnits: 1, caseGroups: 1 });
  });

  it('does not write the application database when preparing an evaluation workspace', () => {
    const appDatabase = join(directory, 'app.db');
    expect(run(['migrate', '--database', appDatabase]).code).toBe(0);
    const before = createHash('sha256').update(readFileSync(appDatabase)).digest('hex');

    const workspace = join(directory, 'evaluation-workspace');
    const artifacts = join(directory, 'evaluation-artifacts');
    const evaluated = run(['evaluate', '--workspace', workspace, '--artifacts', artifacts]);

    expect(evaluated.code).toBe(0);
    const output = JSON.parse(evaluated.stdout) as { status: string; manifestPath: string };
    expect(output.status).toBe('not_implemented');
    expect(existsSync(join(workspace, 'evaluation.db'))).toBe(true);
    expect(existsSync(output.manifestPath)).toBe(true);
    expect(
      createHash('sha256').update(readFileSync(appDatabase)).digest('hex'),
    ).toBe(before);
  });

  it('refuses to import and writes nothing', () => {
    const sources = join(directory, 'sources');
    mkdirSync(sources);
    const imported = run([
      'import',
      '--source',
      sources,
      '--database',
      join(directory, 'app.db'),
    ]);

    expect(imported.code).toBe(2);
    expect(imported.stderr).toContain('belum diimplementasikan');
    expect(existsSync(join(directory, 'app.db'))).toBe(false);
    expect(readdirSync(sources)).toEqual([]);
  });

  it('validates that the import source exists', () => {
    const imported = run(['import', '--source', join(directory, 'missing')]);
    expect(imported.code).toBe(1);
    expect(imported.stderr).toContain('tidak ditemukan');
  });

  it('prints help and rejects unknown commands', () => {
    expect(run(['help']).stdout).toContain('Penggunaan: cbr');
    expect(run([]).code).toBe(1);
    expect(run(['nope']).code).toBe(1);
    expect(run(['nope']).stderr).toContain('tidak dikenal');
  });
});
