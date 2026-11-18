import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CaseBaseIndexManager,
  resolveRetrievalConfig,
} from '@cbr/core';
import {
  closeDatabase,
  createCaseUnit,
  deleteCaseUnit,
  getCaseBaseGeneration,
  insertSourceAlias,
  insertSourceDocument,
  linkCaseUnitSource,
  loadCaseBaseSnapshot,
  loadRetrievalConfig,
  openDatabase,
  retainCaseUnit,
  runMigrations,
  saveRetrievalConfig,
  SqliteCaseBaseSource,
  updateCaseUnitOutcome,
} from './index';

let directory: string;
let db: DatabaseSync;

const draft = {
  court: 'PN Sintetis',
  caseNumber: '1/Pid.B/2024/PN.Sintetis',
  narration: 'terdakwa mengambil sepeda motor milik korban',
  category: 'pencurian',
  actualSentenceDays: 180,
};

function addSource(unitId: string, suffix: string): void {
  insertSourceDocument(db, {
    id: `source-${suffix}`,
    contentHash: `content-${suffix}`,
    normalizedContentHash: `normalized-${suffix}`,
    snapshotPath: `raw/${suffix}.xml`,
    sourceUrl: `https://example.test/${suffix}`,
  });
  insertSourceAlias(db, {
    id: `alias-path-${suffix}`,
    sourceDocumentId: `source-${suffix}`,
    aliasType: 'path',
    aliasValue: `raw/${suffix}.xml`,
  });
  insertSourceAlias(db, {
    id: `alias-xml-${suffix}`,
    sourceDocumentId: `source-${suffix}`,
    aliasType: 'xml_id',
    aliasValue: `xml-${suffix}`,
  });
  insertSourceAlias(db, {
    id: `alias-url-${suffix}`,
    sourceDocumentId: `source-${suffix}`,
    aliasType: 'url',
    aliasValue: `https://example.test/${suffix}`,
  });
  linkCaseUnitSource(db, {
    caseUnitId: unitId,
    sourceDocumentId: `source-${suffix}`,
    narrationLocation: 'fakta',
    outcomeLocation: 'amar',
  });
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cbr-source-'));
  db = openDatabase(join(directory, 'app.db'));
  runMigrations(db);
});

afterEach(() => {
  closeDatabase(db);
  rmSync(directory, { recursive: true, force: true });
});

describe('SQLite case-base snapshot', () => {
  it('returns cases, provenance, aliases, and the generation', () => {
    const first = createCaseUnit(db, draft);
    addSource(first, 'a');
    const second = createCaseUnit(db, {
      ...draft,
      caseNumber: '2/Pid.B/2024/PN.Sintetis',
      actualSentenceDays: 240,
    });
    addSource(second, 'b');

    const snapshot = loadCaseBaseSnapshot(db);

    expect(snapshot.generation).toBe(getCaseBaseGeneration(db).generation);
    expect(snapshot.cases.map((candidate) => candidate.id)).toEqual(
      [first, second].sort(),
    );
    const firstCase = snapshot.cases.find((candidate) => candidate.id === first);
    expect(firstCase?.sources).toHaveLength(1);
    expect(firstCase?.sources?.[0]).toMatchObject({
      sourceDocumentId: 'source-a',
      snapshotPath: 'raw/a.xml',
      sourceUrl: 'https://example.test/a',
      narrationLocation: 'fakta',
      outcomeLocation: 'amar',
    });
    expect(firstCase?.sources?.[0]?.aliases).toEqual([
      'raw/a.xml',
      'https://example.test/a',
      'xml-a',
    ]);
  });

  it('keeps actual outcomes and deletions visible to the next snapshot', () => {
    const first = createCaseUnit(db, draft);
    const second = createCaseUnit(db, {
      ...draft,
      caseNumber: '2/Pid.B/2024/PN.Sintetis',
      actualSentenceDays: 240,
    });

    const before = loadCaseBaseSnapshot(db).generation;
    updateCaseUnitOutcome(db, first, 300);
    expect(getCaseBaseGeneration(db).generation).toBeGreaterThan(before);

    let snapshot = loadCaseBaseSnapshot(db);
    expect(
      snapshot.cases.find((candidate) => candidate.id === first)?.outcome
        .actualSentenceDays,
    ).toBe(300);

    deleteCaseUnit(db, second);
    snapshot = loadCaseBaseSnapshot(db);
    expect(snapshot.cases.map((candidate) => candidate.id)).toEqual([first]);
  });

  it('requires a positive actual outcome for Retain', () => {
    expect(() =>
      retainCaseUnit(db, { ...draft, actualSentenceDays: null }),
    ).toThrow(/positive integer actualSentenceDays/);
    expect(() =>
      retainCaseUnit(db, { ...draft, actualSentenceDays: 0 }),
    ).toThrow(/positive integer actualSentenceDays/);

    const retained = retainCaseUnit(db, {
      ...draft,
      caseNumber: '3/Pid.B/2024/PN.Sintetis',
      actualSentenceDays: 90,
    });
    expect(
      loadCaseBaseSnapshot(db).cases.find((candidate) => candidate.id === retained)
        ?.outcome.actualSentenceDays,
    ).toBe(90);
  });

  it('persists retrieval configuration and advances the generation', () => {
    const before = getCaseBaseGeneration(db).generation;
    expect(loadRetrievalConfig(db).retrieval.maxReferences).toBe(5);

    const config = resolveRetrievalConfig({ retrieval: { maxReferences: 3 } });
    saveRetrievalConfig(db, config);

    expect(getCaseBaseGeneration(db).generation).toBeGreaterThan(before);
    expect(loadRetrievalConfig(db).retrieval.maxReferences).toBe(3);
  });
});

describe('SQLite source with the index manager', () => {
  it('uses a persisted config change after the generation advances', async () => {
    for (let index = 0; index < 4; index += 1) {
      retainCaseUnit(db, {
        ...draft,
        caseNumber: `${index + 1}/Pid.B/2024/PN.Sintetis`,
        actualSentenceDays: 120 + index * 30,
      });
    }

    const manager = new CaseBaseIndexManager({
      source: new SqliteCaseBaseSource(db),
    });
    const request = { facts: { narration: draft.narration } };

    const initial = await manager.estimate(request);
    expect(initial.status).toBe('estimated');
    expect(initial.scoring.maxReferences).toBe(5);
    expect(initial.references).toHaveLength(4);

    saveRetrievalConfig(
      db,
      resolveRetrievalConfig({
        retrieval: { maxReferences: 2 },
        components: { attributes: [] },
      }),
    );

    const changed = await manager.estimate(request);
    expect(changed.caseBaseGeneration).toBeGreaterThan(
      initial.caseBaseGeneration as number,
    );
    expect(changed.scoring.maxReferences).toBe(2);
    expect(changed.references).toHaveLength(2);
  });

  it('rebuilds after an actual-outcome edit and a delete', async () => {
    const first = createCaseUnit(db, draft);
    const second = createCaseUnit(db, {
      ...draft,
      caseNumber: '2/Pid.B/2024/PN.Sintetis',
      actualSentenceDays: 240,
    });

    const manager = new CaseBaseIndexManager({
      source: new SqliteCaseBaseSource(db),
    });
    const request = { facts: { narration: draft.narration } };

    const initial = await manager.estimate(request);
    expect(initial.status).toBe('estimated');
    expect(initial.references).toHaveLength(2);

    updateCaseUnitOutcome(db, first, 600);
    const edited = await manager.estimate(request);
    expect(edited.caseBaseGeneration).toBeGreaterThan(initial.caseBaseGeneration as number);
    expect(
      edited.references.find((reference) => reference.caseUnitId === first)
        ?.actualSentenceDays,
    ).toBe(600);

    deleteCaseUnit(db, second);
    const afterDelete = await manager.estimate(request);
    expect(afterDelete.references.map((reference) => reference.caseUnitId)).toEqual([
      first,
    ]);
  });
});
