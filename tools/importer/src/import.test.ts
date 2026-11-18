import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, getDatabaseStatus, openDatabase } from '@cbr/data';
import { buildManifestFromDataset } from './acquire';
import { runImport } from './import';
import {
  alternativeArticles,
  conflictCopyA,
  conflictCopyB,
  contradictoryCategory,
  formatCopy,
  leakyNarrative,
  malformed,
  multiDefendant,
  outcomeConflict,
  relatedA,
  relatedB,
  singleDefendant,
  singleDefendantCopy,
  specialLaw,
  unknownCategory,
  zeroOutcome,
} from '../test/fixtures';

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cbr-import-'));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

function writeSnapshot(files: Record<string, string>): string {
  const root = join(directory, 'snapshot');
  const dataset = join(root, 'dataset');
  mkdirSync(dataset, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dataset, name), content, 'utf8');
  }
  return root;
}

function importSnapshot(files: Record<string, string>, options?: { report?: string }) {
  const sourceDir = writeSnapshot(files);
  const databasePath = join(directory, 'app.db');
  const reportPath = options?.report ?? join(directory, 'report.json');
  const report = runImport({ sourceDir, databasePath, reportPath });
  return { report, databasePath, reportPath };
}

function ids(databasePath: string, sql: string): Array<Record<string, unknown>> {
  const db = openDatabase(databasePath);
  try {
    return db.prepare(sql).all() as Array<Record<string, unknown>>;
  } finally {
    closeDatabase(db);
  }
}

describe('Indo-Law import', () => {
  it('imports one defendant-case with articles, attributes, provenance, and a report', () => {
    const { report, databasePath } = importSnapshot({ 'single.xml': singleDefendant });

    expect(report.counts).toMatchObject({
      documentsParsed: 1,
      casesAccepted: 1,
      caseGroups: 1,
      sourceDocuments: 1,
    });
    expect(report.categories).toEqual({ pencurian: 1 });
    expect(report.attributes.age_years).toEqual({ present: 1, total: 1 });
    expect(report.attributes.prior_conviction).toEqual({ present: 1, total: 1 });
    expect(report.outcomes.metadataAndVerdict).toBe(1);

    const units = ids(databasePath, 'SELECT * FROM case_unit');
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({
      defendant_name: 'budi bin ahmad',
      actual_sentence_days: 180,
      category: 'pencurian',
    });
    expect(ids(databasePath, 'SELECT * FROM case_article')[0]).toMatchObject({
      law: 'KUHP',
      article: '362',
    });
    expect(ids(databasePath, 'SELECT * FROM case_unit_source')[0]).toMatchObject({
      narration_location: 'riwayat_dakwaan',
      outcome_location: 'amar_putusan',
      source_outcome_kind: 'metadata-and-verdict',
    });
  });

  it('merges byte-identical and format copies without duplicating units or groups', () => {
    const { report, databasePath } = importSnapshot({
      'a.xml': singleDefendant,
      'b.xml': singleDefendantCopy,
      'c.xml': formatCopy,
    });

    expect(report.counts).toMatchObject({
      documentsParsed: 3,
      casesAccepted: 1,
      caseGroups: 1,
      sourceDocuments: 1,
      copiesMerged: 2,
    });
    expect(ids(databasePath, 'SELECT * FROM case_unit')).toHaveLength(1);
    expect(ids(databasePath, 'SELECT * FROM source_alias')).toHaveLength(5);
  });

  it('reports reasons for documents that cannot be mapped to a clear defendant-outcome pair', () => {
    const { report } = importSnapshot({
      'single.xml': singleDefendant,
      'multi.xml': multiDefendant,
      'leaky.xml': leakyNarrative,
      'zero.xml': zeroOutcome,
      'conflict.xml': outcomeConflict,
      'special.xml': specialLaw,
      'broken.xml': malformed,
      'unknown.xml': unknownCategory,
      'contradictory.xml': contradictoryCategory,
    });

    const codes = new Map(report.skipReasons.map((entry) => [entry.code, entry.count]));
    expect(codes.get('multiple_defendants')).toBe(1);
    expect(codes.get('narrative_contains_outcome')).toBe(1);
    expect(codes.get('outcome_not_positive')).toBe(1);
    expect(codes.get('outcome_conflict')).toBe(1);
    expect(codes.get('special_law_charge')).toBe(1);
    expect(codes.get('invalid_xml')).toBe(1);
    expect(report.counts.casesAccepted).toBe(3);
  });

  it('skips conflicting outcomes for the same court, case number, and defendant', () => {
    const { report, databasePath } = importSnapshot({
      'a.xml': conflictCopyA,
      'b.xml': conflictCopyB,
    });

    expect(report.counts.casesAccepted).toBe(0);
    expect(report.counts.conflicts).toBe(1);
    expect(report.skipReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'identity_outcome_conflict', count: 2 }),
      ]),
    );
    expect(ids(databasePath, 'SELECT * FROM case_unit')).toHaveLength(0);
  });

  it('puts explicitly cited related cases in one group for splitting', () => {
    const { report } = importSnapshot({
      'a.xml': relatedA,
      'b.xml': relatedB,
    });

    expect(report.counts.casesAccepted).toBe(2);
    expect(report.counts.caseGroups).toBe(1);
    expect(report.grouping).toMatchObject({
      largestGroup: 2,
      relatedLinks: 2,
      relatedGroupsMerged: 1,
    });
  });

  it('keeps an unknown or contradicted category empty instead of guessing', () => {
    const { report, databasePath } = importSnapshot({
      'unknown.xml': unknownCategory,
      'contradictory.xml': contradictoryCategory,
    });

    expect(report.counts.casesAccepted).toBe(2);
    expect(report.categoryUnknown).toBe(2);
    expect(report.categories).toEqual({});
    expect(ids(databasePath, 'SELECT category FROM case_unit ORDER BY case_number')).toEqual([
      { category: null },
      { category: null },
    ]);
  });

  it('is deterministic across fresh databases', () => {
    const sourceDir = writeSnapshot({ 'single.xml': singleDefendant });
    const firstDatabase = join(directory, 'first.db');
    const secondDatabase = join(directory, 'second.db');

    runImport({
      sourceDir,
      databasePath: firstDatabase,
      reportPath: join(directory, 'first.json'),
    });
    runImport({
      sourceDir,
      databasePath: secondDatabase,
      reportPath: join(directory, 'second.json'),
    });

    const first = ids(firstDatabase, 'SELECT id FROM case_unit ORDER BY id');
    const second = ids(secondDatabase, 'SELECT id FROM case_unit ORDER BY id');
    expect(first).toEqual(second);
  });

  it('replaces the previous import on rerun without duplicating rows', () => {
    const sourceDir = writeSnapshot({ 'single.xml': singleDefendant });
    const databasePath = join(directory, 'app.db');

    runImport({ sourceDir, databasePath, reportPath: join(directory, 'first.json') });
    const first = ids(databasePath, 'SELECT id FROM case_unit');
    runImport({ sourceDir, databasePath, reportPath: join(directory, 'second.json') });

    expect(ids(databasePath, 'SELECT id FROM case_unit')).toEqual(first);
    expect(ids(databasePath, 'SELECT COUNT(*) AS count FROM case_unit')[0]).toEqual({ count: 1 });
  });

  it('verifies a pinned snapshot manifest and rejects a hash mismatch', () => {
    const root = writeSnapshot({
      'single.xml': singleDefendant,
      'alternatives.xml': alternativeArticles,
    });
    const datasetRoot = join(root, 'dataset');
    const manifest = buildManifestFromDataset(datasetRoot, {
      repository: 'ir-nlp-csui/indo-law',
      commit: '67340338adbc63021630947d905627eef0d7e43f',
      datasetTree: '14db967106b2d10c968d73d7b061774b81f508c8',
      archiveUrl: 'https://example.invalid/archive.zip',
      archiveSha256: 'a'.repeat(64),
      archiveBytes: 1,
      downloadedAt: '2026-11-18T00:00:00.000Z',
    });
    writeFileSync(join(root, 'manifest.json'), JSON.stringify(manifest), 'utf8');

    const databasePath = join(directory, 'app.db');
    const report = runImport({
      sourceDir: root,
      databasePath,
      reportPath: join(directory, 'report.json'),
    });
    expect(report.source.manifestVerified).toBe(true);
    expect(report.source.commit).toBe('67340338adbc63021630947d905627eef0d7e43f');
    expect(report.counts.casesAccepted).toBe(2);

    manifest.extraction.files[0] = {
      ...manifest.extraction.files[0]!,
      sha256: 'b'.repeat(64),
    };
    writeFileSync(join(root, 'manifest.json'), JSON.stringify(manifest), 'utf8');
    const mismatch = runImport({
      sourceDir: root,
      databasePath: join(directory, 'mismatch.db'),
      reportPath: join(directory, 'mismatch.json'),
    });
    expect(mismatch.counts.casesAccepted).toBe(1);
    expect(mismatch.skipReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unreadable_file', count: 1 }),
      ]),
    );
  });

  it('writes the report to disk and leaves application configuration untouched', () => {
    const sourceDir = writeSnapshot({ 'single.xml': singleDefendant });
    const databasePath = join(directory, 'app.db');
    const reportPath = join(directory, 'nested', 'report.json');

    runImport({ sourceDir, databasePath, reportPath });
    const db = openDatabase(databasePath);
    try {
      db.prepare('INSERT INTO app_config (key, value_json) VALUES (?, ?)').run(
        'preprocessing',
        JSON.stringify({ lowercase: true }),
      );
      expect(getDatabaseStatus(db).schemaVersion).toBe('002');
    } finally {
      closeDatabase(db);
    }

    runImport({ sourceDir, databasePath, reportPath });
    const reopened = openDatabase(databasePath);
    try {
      expect(reopened.prepare('SELECT COUNT(*) AS count FROM app_config').get()).toEqual({
        count: 1,
      });
    } finally {
      closeDatabase(reopened);
    }
  });
});
