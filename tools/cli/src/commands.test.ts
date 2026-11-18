import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
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
      applied: ['001', '002'],
      schemaVersion: '002',
    });
    expect(existsSync(database)).toBe(true);

    const status = run(['status', '--database', database]);
    expect(status.code).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({
      database,
      exists: true,
      schemaVersion: '002',
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

  it('benchmarks the ready index and writes a report', () => {
    const database = join(directory, 'app.db');
    const draft = {
      court: 'PN Jakarta Pusat',
      caseNumber: '9/Pid.B/2024/PN Jkt.Pst',
      narration: 'terdakwa mengambil sepeda motor milik korban di depan pasar',
      category: 'pencurian',
      actualSentenceDays: 180,
    };

    expect(
      run(['create-case', '--database', database, '--json', JSON.stringify(draft)]).code,
    ).toBe(0);
    expect(
      run([
        'create-case',
        '--database',
        database,
        '--json',
        JSON.stringify({ ...draft, caseNumber: '10/Pid.B/2024/PN Jkt.Pst' }),
      ]).code,
    ).toBe(0);

    const reportPath = join(directory, 'artifacts', 'benchmark.json');
    const benchmark = run([
      'benchmark',
      '--database',
      database,
      '--queries',
      '1',
      '--warmup',
      '0',
      '--report',
      reportPath,
    ]);

    expect(benchmark.code).toBe(0);
    const output = JSON.parse(benchmark.stdout) as {
      reportPath: string;
      dataset: { caseCount: number; eligibleCaseCount: number };
      queries: { selectedCount: number; estimatedCount: number; withheldCount: number };
      latency: { count: number };
    };
    expect(output.reportPath).toBe(reportPath);
    expect(output.dataset).toMatchObject({ caseCount: 2, eligibleCaseCount: 2 });
    expect(output.queries.selectedCount).toBe(1);
    expect(output.queries.estimatedCount + output.queries.withheldCount).toBe(1);
    expect(output.latency.count).toBe(1);
    expect(existsSync(reportPath)).toBe(true);
  });

  it('rejects a benchmark against a missing database', () => {
    const benchmark = run(['benchmark', '--database', join(directory, 'missing.db')]);
    expect(benchmark.code).toBe(1);
    expect(benchmark.stderr).toContain('tidak ditemukan');
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

  it('imports a snapshot and writes a report', () => {
    const sources = join(directory, 'sources');
    const dataset = join(sources, 'dataset');
    mkdirSync(dataset, { recursive: true });
    writeFileSync(
      join(dataset, 'case.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<putusan amar="pidana" amar_lainnya="hukum" id="case-cli" klasifikasi="pidana-umum" lama_hukuman="180" lembaga_peradilan="pn-contoh" provinsi="jabar" status="berkekuatan-hukum-tetap" sub_klasifikasi="pencurian" url="https://example.invalid/case-cli">
<kepala_putusan>putusan nomor 7 pid b 2024 pn contoh demi keadilan berdasarkan ketuhanan yang maha esa pengadilan negeri contoh yang mengadili perkara pidana dalam tingkat pertama menjatuhkan putusan sebagai berikut dalam perkara terdakwa</kepala_putusan>
<identitas>nama lengkap budi bin ahmad umur tanggal lahir 30 tahun 10 maret 1994 jenis kelamin laki laki pekerjaan swasta terdakwa ditahan sejak tanggal 20 mei 2024</identitas>
<riwayat_dakwaan>bahwa ia terdakwa budi bin ahmad pada hari senin tanggal 13 mei 2024 mengambil sepeda motor milik korban sebagaimana diatur dan diancam pidana dalam pasal 362 kuhp</riwayat_dakwaan>
<fakta>menimbang bahwa keterangan saksi menerangkan perbuatan terdakwa</fakta>
<amar_putusan>menyatakan terdakwa budi bin ahmad terbukti bersalah menjatuhkan pidana dengan pidana penjara selama 6 enam bulan</amar_putusan>
</putusan>`,
      'utf8',
    );

    const database = join(directory, 'app.db');
    const imported = run(['import', '--source', sources, '--database', database]);

    expect(imported.code).toBe(0);
    const output = JSON.parse(imported.stdout) as {
      counts: { casesAccepted: number };
      reportPath: string;
    };
    expect(output.counts.casesAccepted).toBe(1);
    expect(existsSync(output.reportPath)).toBe(true);
    expect(existsSync(database)).toBe(true);
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
