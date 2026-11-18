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
  deleteCaseUnit,
  getCaseBaseGeneration,
  getCaseUnit,
  getConfig,
  insertSourceAlias,
  insertSourceDocument,
  linkCaseUnitSource,
  listCaseUnitSources,
  listCaseUnits,
  listCaseUnitSummaries,
  setConfig,
  updateCaseUnit,
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

  it('updates facts and outcome without losing the group or source links', () => {
    const unitId = createCaseUnit(db, draft);
    const groupId = getCaseUnit(db, unitId)?.caseGroupId as string;
    insertSourceDocument(db, {
      id: 'source-1',
      contentHash: 'hash-1',
      snapshotPath: 'synthetic/case-1.xml',
    });
    linkCaseUnitSource(db, { caseUnitId: unitId, sourceDocumentId: 'source-1' });
    const before = getCaseBaseGeneration(db).generation;

    updateCaseUnit(db, unitId, {
      court: 'PN Bandung',
      caseNumber: '999/Pid.B/2025/PN Bdg',
      defendantName: 'Terdakwa Diubah',
      narration: 'Narasi fakta yang diperbarui.',
      category: 'penggelapan',
      actualSentenceDays: 240,
      articles: [{ law: 'KUHP', article: '372' }],
      attributes: {
        role: { type: 'text', value: 'pelaku' },
      },
    });

    const updated = getCaseUnit(db, unitId);
    expect(updated?.identity.court).toBe('PN Bandung');
    expect(updated?.identity.caseNumber).toBe('999/Pid.B/2025/PN Bdg');
    expect(updated?.facts.narration).toBe('Narasi fakta yang diperbarui.');
    expect(updated?.facts.category).toBe('penggelapan');
    expect(updated?.facts.articles).toHaveLength(1);
    expect(updated?.facts.attributes).not.toHaveProperty('age_years');
    expect(updated?.outcome.actualSentenceDays).toBe(240);
    expect(updated?.caseGroupId).toBe(groupId);
    expect(listCaseUnitSources(db, unitId)).toHaveLength(1);
    expect(getCaseBaseGeneration(db).generation).toBeGreaterThan(before);
  });

  it('keeps the existing outcome when an update omits it', () => {
    const unitId = createCaseUnit(db, draft);
    updateCaseUnit(db, unitId, {
      court: draft.court,
      caseNumber: draft.caseNumber,
      narration: 'Narasi baru tanpa menyebut hasil aktual.',
    });

    expect(getCaseUnit(db, unitId)?.outcome.actualSentenceDays).toBe(360);
  });

  it('lists summaries with search and pagination', () => {
    const first = createCaseUnit(db, draft);
    createCaseUnit(db, {
      ...draft,
      court: 'PN Surabaya',
      caseNumber: '7/Pid.B/2024/PN Sby',
      defendantName: 'Terdakwa Lain',
      category: 'penipuan',
    });

    const all = listCaseUnitSummaries(db, { limit: 1, offset: 0 });
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ articleCount: 2, sourceCount: 0 });

    const searched = listCaseUnitSummaries(db, { query: 'surabaya' });
    expect(searched).toHaveLength(1);
    expect(searched[0]?.caseNumber).toBe('7/Pid.B/2024/PN Sby');
    expect(listCaseUnitSummaries(db, { query: 'tidak-ada' })).toHaveLength(0);

    const byId = listCaseUnitSummaries(db, { query: 'jakarta' });
    expect(byId[0]?.id).toBe(first);
  });

  it('returns every alias for a linked source', () => {
    const unitId = createCaseUnit(db, draft);
    insertSourceDocument(db, {
      id: 'source-1',
      contentHash: 'hash-1',
      snapshotPath: 'synthetic/case-1.xml',
      sourceUrl: 'https://example.test/case-1',
    });
    insertSourceAlias(db, {
      id: 'alias-1',
      sourceDocumentId: 'source-1',
      aliasType: 'xml_id',
      aliasValue: 'xml-1',
    });
    insertSourceAlias(db, {
      id: 'alias-2',
      sourceDocumentId: 'source-1',
      aliasType: 'url',
      aliasValue: 'https://example.test/case-1',
    });
    linkCaseUnitSource(db, {
      caseUnitId: unitId,
      sourceDocumentId: 'source-1',
      narrationLocation: 'fakta',
      outcomeLocation: 'amar',
    });

    expect(listCaseUnitSources(db, unitId)).toEqual([
      {
        sourceDocumentId: 'source-1',
        contentHash: 'hash-1',
        snapshotPath: 'synthetic/case-1.xml',
        sourceUrl: 'https://example.test/case-1',
        narrationLocation: 'fakta',
        outcomeLocation: 'amar',
        aliases: ['https://example.test/case-1', 'xml-1'],
      },
    ]);
  });

  it('deletes a case unit and an orphaned group only', () => {
    const first = createCaseUnit(db, draft);
    const groupId = getCaseUnit(db, first)?.caseGroupId as string;
    const second = createCaseUnit(db, {
      ...draft,
      defendantName: 'Terdakwa B',
      caseGroupId: groupId,
    });
    const other = createCaseUnit(db, {
      ...draft,
      court: 'PN Medan',
      caseNumber: '2/Pid.B/2024/PN Mdn',
    });

    expect(deleteCaseUnit(db, first)).toBe(true);
    expect(getCaseUnit(db, first)).toBeNull();
    expect(getCaseUnit(db, second)?.caseGroupId).toBe(groupId);
    expect(countCaseGroups(db)).toBe(2);

    expect(deleteCaseUnit(db, second)).toBe(true);
    expect(countCaseGroups(db)).toBe(1);
    expect(getCaseUnit(db, other)).not.toBeNull();
    expect(deleteCaseUnit(db, 'missing')).toBe(false);
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
