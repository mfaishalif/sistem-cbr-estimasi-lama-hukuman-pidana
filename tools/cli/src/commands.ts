import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { CaseUnitDraft } from '@cbr/core';
import {
  createCaseUnit,
  getCaseBaseGeneration,
  getDatabaseStatus,
  openDatabase,
  runMigrations,
  closeDatabase,
} from '@cbr/data';
import { runImport } from '@cbr/importer';
import type { ParsedArgs } from './args';
import { runBenchmark } from './benchmark';
import {
  EvaluationError,
  runEvaluation,
  type EvaluationStage,
} from './evaluation/pipeline';
import type { SplitProportions } from './evaluation/split';

export interface CliIO {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

export interface CliEnvironment {
  cwd: string;
  env: NodeJS.ProcessEnv;
}

const HELP = `Penggunaan: cbr <perintah> [opsi]

Perintah:
  migrate       Terapkan migrasi yang belum dijalankan.
  status        Tampilkan versi skema, jumlah unit kasus, dan generasi basis kasus.
  create-case   Tambah satu unit kasus dari JSON (--file <path> atau --json <json>).
  import        Impor dan normalisasi basis kasus dari snapshot sumber (--source <dir>).
  benchmark     Ukur latensi Retrieve-Reuse, pembangunan indeks, dan RAM.
  evaluate      Impor snapshot, validasi konfigurasi, dan nilai test pada workspace terpisah.
  help          Tampilkan bantuan ini.

Opsi umum:
  --database <path>   Lokasi SQLite. Default: DATABASE_PATH atau ./data/app.db.

Opsi impor:
  --source <dir>      Direktori snapshot (berisi manifest.json dan dataset/) atau direktori XML.
  --report <path>     Lokasi laporan JSON. Default: <folder database>/import-report.json.
  --limit <n>         Batasi jumlah XML yang diproses (untuk pemeriksaan).

Opsi benchmark:
  --queries <n>       Jumlah kasus uji yang disebar merata. Default: 200.
  --warmup <n>        Pencarian pemanasan yang tidak diukur. Default: 5.
  --report <path>     Tulis laporan benchmark ke JSON.

Opsi evaluasi:
  --workspace <dir>   Direktori kerja evaluasi (wajib).
  --artifacts <dir>   Direktori artefak. Default: <workspace>/artifacts.
  --stage <tahap>     prepare, validate, test, atau all. Default: all.
  --source <dir>      Direktori snapshot untuk prepare (dipasang read-only).
  --seed <teks>       Seed split. Default: indo-law-cbr-v1.
  --proportions <a,b,c>  Proporsi training,validasi,test. Default: 0.7,0.15,0.15.
  --limit <n>         Batasi jumlah XML saat impor evaluasi.
  --min-validation-units <n>     Minimum unit validasi. Default: 100.
  --min-validation-groups <n>    Minimum kelompok validasi. Default: 50.
  --min-candidate-estimates <n>  Minimum estimasi per kandidat. Default: 50.

Contoh:
  cbr migrate --database /data/app.db
  cbr status --database /data/app.db
  cbr create-case --file case.json
  cbr import --source /sources/indo-law --database /data/app.db
  cbr benchmark --database /data/app.db --queries 200 --report artifacts/benchmark.json
  cbr evaluate --source /sources/indo-law --workspace /workspace --artifacts /artifacts --stage all
`;

function databasePath(parsed: ParsedArgs, environment: CliEnvironment): string {
  return (
    parsed.flags.database ??
    environment.env.DATABASE_PATH ??
    join(environment.cwd, 'data', 'app.db')
  );
}

function print(io: CliIO, value: unknown): void {
  io.stdout(JSON.stringify(value, null, 2));
}

function commandMigrate(parsed: ParsedArgs, io: CliIO, environment: CliEnvironment): number {
  const path = databasePath(parsed, environment);
  const db = openDatabase(path);
  try {
    const result = runMigrations(db);
    print(io, {
      database: path,
      applied: result.applied,
      schemaVersion: result.schemaVersion,
    });
    return 0;
  } finally {
    closeDatabase(db);
  }
}

function commandStatus(parsed: ParsedArgs, io: CliIO, environment: CliEnvironment): number {
  const path = databasePath(parsed, environment);
  if (!existsSync(path)) {
    print(io, { database: path, exists: false });
    return 0;
  }

  const db = openDatabase(path);
  try {
    print(io, {
      database: path,
      exists: true,
      ...getDatabaseStatus(db),
    });
    return 0;
  } finally {
    closeDatabase(db);
  }
}

function commandCreateCase(
  parsed: ParsedArgs,
  io: CliIO,
  environment: CliEnvironment,
): number {
  const jsonFlag = parsed.flags.json;
  const fileFlag = parsed.flags.file;

  let raw: string;
  if (jsonFlag !== undefined) {
    if (jsonFlag === 'true') {
      io.stderr('create-case memerlukan nilai setelah --json.');
      return 1;
    }
    raw = jsonFlag;
  } else if (fileFlag !== undefined) {
    raw = readFileSync(resolve(environment.cwd, fileFlag), 'utf8');
  } else {
    io.stderr('create-case memerlukan --file <path> atau --json <json>.');
    return 1;
  }

  const draft = JSON.parse(raw) as CaseUnitDraft;
  const path = databasePath(parsed, environment);
  const db = openDatabase(path);
  try {
    runMigrations(db);
    const caseUnitId = createCaseUnit(db, draft);
    print(io, {
      database: path,
      caseUnitId,
      generation: getCaseBaseGeneration(db).generation,
    });
    return 0;
  } finally {
    closeDatabase(db);
  }
}

function commandImport(parsed: ParsedArgs, io: CliIO, environment: CliEnvironment): number {
  const sourceFlag = parsed.flags.source;
  if (sourceFlag === undefined) {
    io.stderr('import memerlukan --source <direktori snapshot sumber>.');
    return 1;
  }

  const source = resolve(environment.cwd, sourceFlag);
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    io.stderr(`Direktori sumber tidak ditemukan: ${source}`);
    return 1;
  }

  let limit: number | undefined;
  if (parsed.flags.limit !== undefined) {
    limit = Number.parseInt(parsed.flags.limit, 10);
    if (!Number.isSafeInteger(limit) || limit < 1) {
      io.stderr('--limit harus berupa bilangan bulat positif.');
      return 1;
    }
  }

  const database = databasePath(parsed, environment);
  const reportPath =
    parsed.flags.report === undefined
      ? join(dirname(database), 'import-report.json')
      : resolve(environment.cwd, parsed.flags.report);

  const report = runImport({
    sourceDir: source,
    databasePath: database,
    reportPath,
    limit,
    replace: true,
  });

  print(io, { ...report, reportPath });
  return 0;
}

function integerOption(
  value: string | undefined,
  label: string,
  min: number,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min) {
    throw new Error(`${label} harus bilangan bulat ${min === 0 ? 'nol atau positif' : 'positif'}.`);
  }
  return parsed;
}

function commandBenchmark(
  parsed: ParsedArgs,
  io: CliIO,
  environment: CliEnvironment,
): number {
  const database = databasePath(parsed, environment);
  if (!existsSync(database)) {
    io.stderr(`Basis data tidak ditemukan: ${database}`);
    return 1;
  }

  let queryLimit: number | undefined;
  let warmupCount: number | undefined;
  try {
    queryLimit = integerOption(parsed.flags.queries, '--queries', 1);
    warmupCount = integerOption(parsed.flags.warmup, '--warmup', 0);
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const report = runBenchmark({
    databasePath: database,
    queryLimit,
    warmupCount,
  });

  const reportFlag = parsed.flags.report;
  if (reportFlag === undefined) {
    print(io, report);
    return 0;
  }

  const reportPath = resolve(environment.cwd, reportFlag);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  print(io, { ...report, reportPath });
  return 0;
}

const EVALUATION_STAGES: readonly EvaluationStage[] = [
  'prepare',
  'validate',
  'test',
  'all',
];

function evaluationStage(value: string | undefined): EvaluationStage {
  if (value === undefined) {
    return 'all';
  }
  if (!EVALUATION_STAGES.includes(value as EvaluationStage)) {
    throw new EvaluationError(
      'INPUT_TIDAK_VALID',
      `--stage harus salah satu dari: ${EVALUATION_STAGES.join(', ')}.`,
      { stage: value },
    );
  }
  return value as EvaluationStage;
}

function splitProportions(value: string | undefined): SplitProportions | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parts = value.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    throw new EvaluationError(
      'INPUT_TIDAK_VALID',
      '--proportions harus berisi tiga angka: training,validasi,test.',
      { value },
    );
  }
  return {
    training: parts[0] as number,
    validation: parts[1] as number,
    test: parts[2] as number,
  };
}

function evaluationInteger(
  value: string | undefined,
  label: string,
  min: number,
): number | undefined {
  try {
    return integerOption(value, label, min);
  } catch (error) {
    throw new EvaluationError(
      'INPUT_TIDAK_VALID',
      error instanceof Error ? error.message : String(error),
      { option: label, value },
    );
  }
}

function commandEvaluate(parsed: ParsedArgs, io: CliIO, environment: CliEnvironment): number {
  const workspaceFlag = parsed.flags.workspace;
  if (workspaceFlag === undefined) {
    io.stderr(
      JSON.stringify(
        {
          status: 'error',
          code: 'INPUT_TIDAK_VALID',
          message: 'evaluate memerlukan --workspace <direktori kerja evaluasi>.',
          exitCode: 2,
          details: null,
        },
        null,
        2,
      ),
    );
    return 2;
  }

  const workspace = resolve(environment.cwd, workspaceFlag);
  const artifacts = resolve(
    environment.cwd,
    parsed.flags.artifacts ?? join(workspace, 'artifacts'),
  );

  try {
    const sourceFlag = parsed.flags.source;
    const result = runEvaluation({
      workspace,
      artifacts,
      stage: evaluationStage(parsed.flags.stage),
      sourceDir: sourceFlag === undefined ? undefined : resolve(environment.cwd, sourceFlag),
      seed: parsed.flags.seed,
      proportions: splitProportions(parsed.flags.proportions),
      limit: evaluationInteger(parsed.flags.limit, '--limit', 1),
      minValidationUnits: evaluationInteger(
        parsed.flags['min-validation-units'],
        '--min-validation-units',
        0,
      ),
      minValidationGroups: evaluationInteger(
        parsed.flags['min-validation-groups'],
        '--min-validation-groups',
        0,
      ),
      minCandidateEstimates: evaluationInteger(
        parsed.flags['min-candidate-estimates'],
        '--min-candidate-estimates',
        0,
      ),
    });
    print(io, result);
    return result.exitCode;
  } catch (error) {
    if (error instanceof EvaluationError) {
      io.stderr(
        JSON.stringify(
          {
            status: 'error',
            code: error.code,
            message: error.message,
            exitCode: error.exitCode,
            details: error.details ?? null,
          },
          null,
          2,
        ),
      );
      return error.exitCode;
    }
    throw error;
  }
}

export function runCli(
  io: CliIO,
  environment: CliEnvironment,
  parsed: ParsedArgs,
): number {
  try {
    switch (parsed.command) {
      case 'help':
      case null:
        io.stdout(HELP);
        return parsed.command === null ? 1 : 0;
      case 'migrate':
        return commandMigrate(parsed, io, environment);
      case 'status':
        return commandStatus(parsed, io, environment);
      case 'create-case':
        return commandCreateCase(parsed, io, environment);
      case 'import':
        return commandImport(parsed, io, environment);
      case 'benchmark':
        return commandBenchmark(parsed, io, environment);
      case 'evaluate':
        return commandEvaluate(parsed, io, environment);
      default:
        io.stderr(`Perintah tidak dikenal: ${parsed.command}\n`);
        io.stderr(HELP);
        return 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`Gagal menjalankan ${parsed.command ?? 'perintah'}: ${message}`);
    return 1;
  }
}
