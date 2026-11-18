import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runMigrations } from './migrations';
import {
  countCaseGroups,
  countCaseUnits,
  createCaseUnit,
  getCaseBaseGeneration,
  getCaseUnit,
  getConfig,
  listCaseUnits,
  setConfig,
  ValidationError,
} from './repositories';
import { closeDatabase, openDatabase } from './sqlite';

let directory: string;
let databasePath: string;
let db: DatabaseSync;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cbr-repositories-'));
  databasePath = join(directory, 'app.db');
  db = openDatabase(databasePath);
  runMigrations(db);
});

afterEach(() => {
  closeDatabase(db);
  rmSync(directory, { recursive: true, force: true });
});

const draft = {
  court: 'PN Jakarta Pusat',
  caseNumber: '123/Pid.B/2024/PN Jkt.Pst',
  defendantName: 'Terdakwa A',
  narration: 'Terdakwa mengambil satu unit sepeda motor milik korban pada malam hari.',
  category: 'pencurian',
  actualSentenceDays: 360,
  articles: [
    { law: 'KUHP', article: '362', arrangement: 'primary' as const },
    { law: 'KUHP', article: '363', arrangement: 'subsidiary' as const },
  ],
  attributes: {
    age_years: { type: 'number' as const, value: 27, unit: 'tahun' },
    age_reference_date: { type: 'text' as const, value: '2024-03-01' },
    prior_conviction: { type: 'enum' as const, value: 'no' },
    role: { type: 'enum' as const, value: 'pelaku' },
  },
};

describe('case unit repository', () => {
  it('creates and reads a case unit with its group, articles, and attributes', () => {
    const unitId = createCaseUnit(db, draft);
    const unit = getCaseUnit(db, unitId);

    expect(unit).not.toBeNull();
    expect(unit?.id).toBe(unitId);
    expect(unit?.identity).toEqual({
      court: 'PN Jakarta Pusat',
      caseNumber: '123/Pid.B/2024/PN Jkt.Pst',
      defendantName: 'Terdakwa A',
    });
    expect(unit?.facts.narration).toContain('sepeda motor');
    expect(unit?.facts.category).toBe('pencurian');
    expect(unit?.facts.articles).toHaveLength(2);
    expect(unit?.facts.articles?.[1]?.arrangement).toBe('subsidiary');
    expect(unit?.facts.attributes?.age_years).toEqual({
      type: 'number',
      value: 27,
      unit: 'tahun',
    });
    expect(unit?.outcome.actualSentenceDays).toBe(360);
    expect(countCaseUnits(db)).toBe(1);
    expect(countCaseGroups(db)).toBe(1);
  });

  it('keeps unknown attributes distinct from explicit none and zero', () => {
    const withKnownValues = createCaseUnit(db, draft);
    const withoutValues = createCaseUnit(db, {
      court: 'PN Bandung',
      caseNumber: '456/Pid.B/2024/PN Bdg',
      narration: 'Narasi perkara lain.',
    });

    const known = getCaseUnit(db, withKnownValues);
    const unknown = getCaseUnit(db, withoutValues);

    expect(known?.facts.attributes?.prior_conviction).toEqual({ type: 'enum', value: 'no' });
    expect(unknown?.facts.attributes).not.toHaveProperty('prior_conviction');
    expect(unknown?.facts.attributes).not.toHaveProperty('age_years');
    expect(unknown?.outcome.actualSentenceDays).toBeNull();
  });

  it('stores boolean attributes without turning false into unknown', () => {
    const unitId = createCaseUnit(db, {
      court: 'PN Semarang',
      caseNumber: '789/Pid.B/2024/PN Smg',
      narration: 'Narasi perkara dengan atribut boolean.',
      attributes: {
        victim_harm: { type: 'boolean', value: false },
      },
    });

    expect(getCaseUnit(db, unitId)?.facts.attributes?.victim_harm).toEqual({
      type: 'boolean',
      value: false,
    });
  });

  it('allows several units in the same case group', () => {
    const first = createCaseUnit(db, draft);
    const groupId = getCaseUnit(db, first)?.caseGroupId as string;
    const second = createCaseUnit(db, {
      ...draft,
      caseNumber: '123/Pid.B/2024/PN Jkt.Pst',
      defendantName: 'Terdakwa B',
      caseGroupId: groupId,
    });

    expect(getCaseUnit(db, second)?.caseGroupId).toBe(groupId);
    expect(countCaseGroups(db)).toBe(1);
    expect(countCaseUnits(db)).toBe(2);
    expect(listCaseUnits(db)).toHaveLength(2);
  });

  it('stores a known zero-day outcome separately from an unknown outcome', () => {
    const knownZero = createCaseUnit(db, {
      ...draft,
      actualSentenceDays: 0,
    });
    const unknown = createCaseUnit(db, {
      ...draft,
      defendantName: 'Terdakwa B',
      actualSentenceDays: null,
    });

    expect(getCaseUnit(db, knownZero)?.outcome.actualSentenceDays).toBe(0);
    expect(getCaseUnit(db, unknown)?.outcome.actualSentenceDays).toBeNull();
  });

  it('normalizes case identity for matching while preserving display values', () => {
    const unitId = createCaseUnit(db, draft);
    const row = db
      .prepare(
        'SELECT court, case_number, court_normalized, case_number_normalized FROM case_unit WHERE id = ?',
      )
      .get(unitId) as {
      court: string;
      case_number: string;
      court_normalized: string;
      case_number_normalized: string;
    };

    expect(row.court).toBe('PN Jakarta Pusat');
    expect(row.court_normalized).toBe('pn jakarta pusat');
    expect(row.case_number_normalized).toBe('123/pidb/2024/pn jktpst');
  });

  it('keeps source locations for category, articles, and attributes', () => {
    const unitId = createCaseUnit(db, {
      ...draft,
      categorySourceLocation: 'dakwaan.uraian',
      articles: [
        {
          law: 'KUHP',
          article: '362',
          sourceLocation: 'dakwaan.pasal',
        },
      ],
      attributes: {
        age_years: { type: 'number', value: 27, sourceLocation: 'dakwaan.umur' },
      },
    });

    const unit = getCaseUnit(db, unitId);
    expect(unit?.facts.categorySourceLocation).toBe('dakwaan.uraian');
    expect(unit?.facts.articles?.[0]?.sourceLocation).toBe('dakwaan.pasal');
    expect(unit?.facts.attributes?.age_years).toMatchObject({
      type: 'number',
      value: 27,
      sourceLocation: 'dakwaan.umur',
    });
  });

  it('rejects invalid drafts before writing anything', () => {
    expect(() => createCaseUnit(db, { ...draft, narration: '   ' })).toThrow(ValidationError);
    expect(() => createCaseUnit(db, { ...draft, actualSentenceDays: -1 })).toThrow(ValidationError);
    expect(() => createCaseUnit(db, { ...draft, actualSentenceDays: 1.5 })).toThrow(ValidationError);
    expect(() => createCaseUnit(db, { ...draft, caseGroupId: 'missing' })).toThrow(ValidationError);
    expect(() =>
      createCaseUnit(db, {
        ...draft,
        attributes: { prior_conviction: { type: 'boolean', value: true } },
      }),
    ).toThrow(ValidationError);
    expect(() =>
      createCaseUnit(db, {
        ...draft,
        attributes: { prior_conviction: { type: 'enum', value: 'maybe' } },
      }),
    ).toThrow(ValidationError);
    expect(() =>
      createCaseUnit(db, {
        ...draft,
        attributes: { age_years: { type: 'text', value: '27' } },
      }),
    ).toThrow(ValidationError);

    expect(countCaseUnits(db)).toBe(0);
  });

  it('returns null for an unknown case unit', () => {
    expect(getCaseUnit(db, 'missing')).toBeNull();
  });

  it('does not expose an estimate column', () => {
    const columns = (
      db.prepare('PRAGMA table_info(case_unit)').all() as Array<{ name: string }>
    ).map((column) => column.name);

    expect(columns).toContain('actual_sentence_days');
    expect(columns.some((name) => name.includes('estimate'))).toBe(false);
  });

  it('persists data after closing and reopening the database file', () => {
    const unitId = createCaseUnit(db, draft);
    closeDatabase(db);

    db = openDatabase(databasePath);
    const reopened = getCaseUnit(db, unitId);

    expect(reopened?.facts.narration).toContain('sepeda motor');
    expect(reopened?.outcome.actualSentenceDays).toBe(360);
  });
});

describe('case base generation and configuration', () => {
  it('advances the generation on case and configuration changes', () => {
    const initial = getCaseBaseGeneration(db).generation;
    const unitId = createCaseUnit(db, draft);
    const afterCreate = getCaseBaseGeneration(db).generation;

    expect(afterCreate).toBeGreaterThan(initial);

    db.prepare('UPDATE case_unit SET narration = ? WHERE id = ?').run('Narasi diubah.', unitId);
    const afterUpdate = getCaseBaseGeneration(db).generation;
    expect(afterUpdate).toBeGreaterThan(afterCreate);

    db.prepare('DELETE FROM case_unit WHERE id = ?').run(unitId);
    expect(getCaseBaseGeneration(db).generation).toBeGreaterThan(afterUpdate);
  });

  it('stores JSON configuration and advances the generation', () => {
    const before = getCaseBaseGeneration(db).generation;
    const saved = setConfig(db, 'preprocessing', { lowercase: true, minTokenLength: 2 });

    expect(saved.value).toEqual({ lowercase: true, minTokenLength: 2 });
    expect(getConfig<{ lowercase: boolean }>(db, 'preprocessing')?.value.lowercase).toBe(true);
    expect(getConfig(db, 'missing')).toBeNull();
    expect(getCaseBaseGeneration(db).generation).toBeGreaterThan(before);
  });
});
