import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { CaseUnitDraft } from '@cbr/core';
import {
  createCaseUnit,
  getCaseBaseGeneration,
  getDatabaseStatus,
  openDatabase,
  runMigrations,
  closeDatabase,
} from '@cbr/data';
import type { ParsedArgs } from './args';

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
  import        Impor basis kasus dari sumber mentah (belum diimplementasikan).
  evaluate      Siapkan workspace evaluasi terpisah (pipeline evaluasi belum diimplementasikan).
  help          Tampilkan bantuan ini.

Opsi umum:
  --database <path>   Lokasi SQLite. Default: DATABASE_PATH atau ./data/app.db.

Contoh:
  cbr migrate --database /data/app.db
  cbr status --database /data/app.db
  cbr create-case --file case.json
  cbr evaluate --workspace /workspace --artifacts /artifacts
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
    io.stderr('import memerlukan --source <direktori sumber mentah>.');
    return 1;
  }

  const source = resolve(environment.cwd, sourceFlag);
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    io.stderr(`Direktori sumber tidak ditemukan: ${source}`);
    return 1;
  }

  io.stderr(
    [
      'Impor basis kasus belum diimplementasikan pada tiket fondasi.',
      `Sumber (read-only): ${source}`,
      `Database tujuan: ${databasePath(parsed, environment)}`,
      'Tidak ada data yang ditulis oleh perintah ini.',
      'Tiket impor akan mengisi ekstraksi, validasi, dan laporan kelolosan.',
    ].join('\n'),
  );
  return 2;
}

function commandEvaluate(parsed: ParsedArgs, io: CliIO, environment: CliEnvironment): number {
  const workspaceFlag = parsed.flags.workspace;
  if (workspaceFlag === undefined) {
    io.stderr('evaluate memerlukan --workspace <direktori kerja evaluasi>.');
    return 1;
  }

  const workspace = resolve(environment.cwd, workspaceFlag);
  const artifacts = resolve(
    environment.cwd,
    parsed.flags.artifacts ?? join(workspace, 'artifacts'),
  );
  mkdirSync(workspace, { recursive: true });
  mkdirSync(artifacts, { recursive: true });

  const evaluationDatabase = join(workspace, 'evaluation.db');
  const db = openDatabase(evaluationDatabase);
  try {
    const migrations = runMigrations(db);
    const manifest = {
      status: 'not_implemented',
      note: 'Pipeline evaluasi CBR belum diimplementasikan. Perintah ini hanya menyiapkan workspace evaluasi terpisah.',
      createdAt: new Date().toISOString(),
      evaluationDatabase,
      artifacts,
      schemaVersion: migrations.schemaVersion,
      appliedMigrations: migrations.applied,
      applicationDatabase:
        'database aplikasi tidak dipasang pada layanan evaluasi (lihat compose.yaml)',
    };

    const manifestPath = join(artifacts, 'evaluation-manifest.json');
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    print(io, { ...manifest, manifestPath });
    return 0;
  } finally {
    closeDatabase(db);
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
