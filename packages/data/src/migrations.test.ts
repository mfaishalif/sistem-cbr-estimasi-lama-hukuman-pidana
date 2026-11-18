import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSchemaVersion, migrations, runMigrations } from './migrations';
import { closeDatabase, openDatabase } from './sqlite';

let directory: string;
let db: DatabaseSync;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cbr-migrations-'));
  db = openDatabase(join(directory, 'app.db'));
});

afterEach(() => {
  closeDatabase(db);
  rmSync(directory, { recursive: true, force: true });
});

describe('migrations', () => {
  it('applies the initial schema to an empty database', () => {
    const result = runMigrations(db);

    expect(result.applied).toEqual(['001', '002']);
    expect(result.schemaVersion).toBe('002');
    expect(getSchemaVersion(db)).toBe('002');
  });

  it('is idempotent', () => {
    runMigrations(db);
    const secondRun = runMigrations(db);

    expect(secondRun.applied).toEqual([]);
    expect(secondRun.schemaVersion).toBe('002');
  });

  it('creates the agreed tables and no audit/version-history tables', () => {
    runMigrations(db);

    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{
        name: string;
      }>
    ).map((row) => row.name);

    expect(tables).toEqual(
      expect.arrayContaining([
        'app_config',
        'case_article',
        'case_base_generation',
        'case_fact_attribute',
        'case_group',
        'case_unit',
        'case_unit_source',
        'schema_migrations',
        'source_alias',
        'source_document',
      ]),
    );

    expect(tables).not.toContain('audit_log');
    expect(tables).not.toContain('case_version');
  });

  it('starts the case base generation at zero', () => {
    runMigrations(db);

    const row = db
      .prepare('SELECT generation FROM case_base_generation WHERE id = 1')
      .get() as { generation: number };
    expect(row.generation).toBe(0);
  });

  it('rejects invalid narration, outcomes, attributes, and config JSON at the database level', () => {
    runMigrations(db);

    db.prepare("INSERT INTO case_group (id) VALUES ('group-1')").run();

    expect(() =>
      db
        .prepare(
          `INSERT INTO case_unit
             (id, case_group_id, court, case_number, court_normalized, case_number_normalized,
              narration)
           VALUES ('unit-1', 'group-1', 'PN', '1/PID/2024', 'pn', '1/pid/2024', '   ')`,
        )
        .run(),
    ).toThrow(/CHECK constraint failed/);

    expect(() =>
      db
        .prepare(
          `INSERT INTO case_unit
             (id, case_group_id, court, case_number, court_normalized, case_number_normalized,
              narration, actual_sentence_days)
           VALUES ('unit-2', 'group-1', 'PN', '2/PID/2024', 'pn', '2/pid/2024', 'Narasi', -1)`,
        )
        .run(),
    ).toThrow(/CHECK constraint failed/);

    db.prepare(
      `INSERT INTO case_unit
         (id, case_group_id, court, case_number, court_normalized, case_number_normalized,
          narration, actual_sentence_days)
       VALUES ('unit-3', 'group-1', 'PN', '3/PID/2024', 'pn', '3/pid/2024', 'Narasi', 0)`,
    ).run();

    const outcomes = db
      .prepare("SELECT actual_sentence_days FROM case_unit WHERE id IN ('unit-2', 'unit-3')")
      .all() as Array<{ actual_sentence_days: number | null }>;
    expect(outcomes).toEqual([{ actual_sentence_days: 0 }]);

    expect(() =>
      db
        .prepare(
          `INSERT INTO case_fact_attribute
             (case_unit_id, attribute_key, value_type, value_number)
           VALUES ('unit-3', 'age_years', 'number', NULL)`,
        )
        .run(),
    ).toThrow(/CHECK constraint failed/);

    expect(() =>
      db.prepare("INSERT INTO app_config (key, value_json) VALUES ('x', 'not json')").run(),
    ).toThrow(/CHECK constraint failed/);
  });

  it('keeps a custom migration list ordered by the caller', () => {
    const result = runMigrations(db, [
      { id: '001', name: 'first', sql: 'CREATE TABLE first (id TEXT);' },
      { id: '002', name: 'second', sql: 'CREATE TABLE second (id TEXT);' },
    ]);

    expect(result.applied).toEqual(['001', '002']);
    expect(result.schemaVersion).toBe('002');
    expect(migrations).toHaveLength(2);
  });
});
