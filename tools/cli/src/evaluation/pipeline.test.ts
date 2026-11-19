import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, openDatabase } from '@cbr/data';
import {
  EVALUATION_LOCK_FILE,
  EVALUATION_TEST_FILE,
  EvaluationError,
  prepareEvaluation,
  runEvaluation,
  testEvaluation,
  validateEvaluation,
  type EvaluationOptions,
} from './pipeline';
import type { SplitManifest } from './split';

const FIXTURE = fileURLToPath(
  new URL('../../../../fixtures/indo-law-synthetic', import.meta.url),
);

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cbr-eval-pipeline-'));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

function options(extra: Partial<EvaluationOptions> = {}): EvaluationOptions {
  return {
    workspace: join(directory, 'workspace'),
    artifacts: join(directory, 'artifacts'),
    sourceDir: FIXTURE,
    minValidationUnits: 8,
    minValidationGroups: 8,
    minCandidateEstimates: 0,
    ...extra,
  };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function prepareValidateTest(extra: Partial<EvaluationOptions> = {}) {
  const opts = options(extra);
  const prepared = prepareEvaluation(opts);
  const validated = validateEvaluation(opts);
  const tested = testEvaluation(opts);
  return { opts, prepared, validated, tested };
}

const EXPECTED_UNIT_COUNT = 90;

describe('evaluation pipeline', () => {
  it('prepares a group-disjoint split without touching an application database', () => {
    const opts = options();
    const prepared = prepareEvaluation(opts);

    expect(prepared.status).toBe('prepared');
    expect(prepared.exitCode).toBe(0);
    expect(prepared.counts).toMatchObject({ units: EXPECTED_UNIT_COUNT, groups: EXPECTED_UNIT_COUNT });
    expect(Number(prepared.durationMs)).toBeGreaterThanOrEqual(0);

    const manifest = readJson<{
      checks: { everyUnitAssignedOnce: boolean; groupsDisjoint: boolean; emptySplits: string[] };
      perSplit: Record<string, { units: number; groups: number }>;
      fingerprints: { manifest: string; caseBase: string; split: string };
      source: { commit: string | null };
    }>(join(opts.artifacts, 'evaluation-manifest.json'));
    const split = readJson<SplitManifest>(join(opts.artifacts, 'split-manifest.json'));

    expect(manifest.checks).toEqual({
      everyUnitAssignedOnce: true,
      groupsDisjoint: true,
      emptySplits: [],
    });
    expect(manifest.source.commit).toBe('a'.repeat(40));
    expect(manifest.fingerprints.manifest).toHaveLength(16);
    expect(split.assignments).toHaveLength(EXPECTED_UNIT_COUNT);

    const groupsBySplit = new Map<string, Set<string>>();
    const seenUnits = new Set<string>();
    for (const assignment of split.assignments) {
      expect(seenUnits.has(assignment.id)).toBe(false);
      seenUnits.add(assignment.id);
      const splits = groupsBySplit.get(assignment.caseGroupId) ?? new Set<string>();
      splits.add(assignment.split);
      groupsBySplit.set(assignment.caseGroupId, splits);
    }
    expect([...groupsBySplit.values()].every((splits) => splits.size === 1)).toBe(true);
    expect(seenUnits.size).toBe(EXPECTED_UNIT_COUNT);

    expect(existsSync(join(opts.workspace, 'evaluation.db'))).toBe(true);
    expect(existsSync(join(opts.artifacts, 'import-report.json'))).toBe(true);
    // The fixture is read-only test data and no application database path exists here.
    expect(existsSync(join(opts.workspace, 'app.db'))).toBe(false);
  });

  it('validates the grid, locks one configuration, and only then tests it', () => {
    const opts = options();
    prepareEvaluation(opts);
    const validated = validateEvaluation(opts);

    expect(validated.status).toBe('validated');
    expect(validated.exitCode).toBe(0);
    expect(validated.gridCandidateCount).toBe(32);
    expect(existsSync(join(opts.artifacts, EVALUATION_LOCK_FILE))).toBe(true);
    expect(existsSync(join(opts.artifacts, EVALUATION_TEST_FILE))).toBe(false);

    const lock = readJson<{
      manifestFingerprint: string;
      configFingerprint: string;
      selected: { id: string };
    }>(join(opts.artifacts, EVALUATION_LOCK_FILE));
    const validation = readJson<{
      manifestFingerprint: string;
      grid: { candidates: unknown[]; targetMet: boolean; rule: string };
      selected: { id: string; configFingerprint: string; validationFingerprint: string };
    }>(join(opts.artifacts, 'validation-report.json'));

    expect(validation.grid.candidates).toHaveLength(32);
    expect(validation.grid.candidates[0]).toMatchObject({
      overallMedianOnAcceptedUnits: { status: 'available' },
      overallMedianOnEligibleUnits: { status: 'available' },
    });
    expect(validation.selected.id).toBe(lock.selected.id);
    expect(validation.selected.configFingerprint).toBe(lock.configFingerprint);
    expect(validation.manifestFingerprint).toBe(lock.manifestFingerprint);
    expect(
      validation.grid.targetMet ||
        validation.grid.rule === 'coverage-target-not-achieved',
    ).toBe(true);

    const tested = testEvaluation(opts);
    expect(tested.status).toBe('tested');
    expect(tested.exitCode).toBe(0);

    const testReport = readJson<{
      lockFingerprint: string;
      checks: Record<string, boolean>;
      models: Array<{
        id: string;
        aggregation: string;
        predictionFingerprint: string;
        report: { coverage: { status: string; value?: number }; cbr: { status: string } };
      }>;
      paired: { unitCount: number; models: unknown[] };
    }>(join(opts.artifacts, EVALUATION_TEST_FILE));

    expect(testReport.lockFingerprint).toBe(lock.configFingerprint);
    expect(testReport.checks).toMatchObject({
      groupsDisjoint: true,
      everyUnitAssignedOnce: true,
      manifestMatchesSnapshot: true,
      lockMatchesManifest: true,
    });
    expect(testReport.models.map((model) => model.id)).toEqual([
      'cbr-gabungan-berbobot',
      'cbr-narasi-berbobot',
      'cbr-gabungan-tanpa-bobot',
    ]);
    expect(testReport.models.map((model) => model.aggregation)).toEqual([
      'weighted',
      'weighted',
      'unweighted',
    ]);
    expect(testReport.paired.models).toHaveLength(3);
    expect(testReport.paired.models[0]).toMatchObject({
      overallMedianOnAcceptedUnits: { unitCount: testReport.paired.unitCount },
    });
    expect(testReport.models[0]?.report).toMatchObject({
      overallMedianOnAcceptedUnits: { status: 'available' },
      overallMedianOnEligibleUnits: { status: 'available' },
    });
    expect(tested).toMatchObject({
      models: testReport.models.map((model) => ({
        id: model.id,
        overallMedianOnAcceptedUnits: { status: 'available' },
        overallMedianOnEligibleUnits: { status: 'available' },
      })),
    });
    expect(testReport.models.every((model) => model.report.coverage.status === 'available')).toBe(
      true,
    );
    expect(existsSync(join(opts.workspace, 'test-per-unit.jsonl'))).toBe(true);
    expect(existsSync(join(opts.workspace, 'validation-per-unit.jsonl'))).toBe(true);
  });

  it('reproduces the same selection and test predictions on a rerun', () => {
    const opts = options();
    prepareEvaluation(opts);

    const firstValidation = validateEvaluation(opts);
    const firstTest = testEvaluation(opts);
    const secondValidation = validateEvaluation(opts);
    const secondTest = testEvaluation(opts);

    const firstSelected = firstValidation.selected as {
      id: string;
      configFingerprint: string;
      validationFingerprint: string;
    };
    const secondSelected = secondValidation.selected as {
      id: string;
      configFingerprint: string;
      validationFingerprint: string;
    };
    expect(secondSelected.id).toBe(firstSelected.id);
    expect(secondSelected.configFingerprint).toBe(firstSelected.configFingerprint);
    expect(secondSelected.validationFingerprint).toBe(
      firstSelected.validationFingerprint,
    );

    const fingerprints = (result: unknown) =>
      (result as { models: Array<{ id: string; predictionFingerprint: string }> }).models.map(
        (model) => [model.id, model.predictionFingerprint],
      );
    expect(fingerprints(secondTest)).toEqual(fingerprints(firstTest));
  });

  it('refuses test without a lock and refuses a lock after the snapshot changes', () => {
    const opts = options();
    prepareEvaluation(opts);

    expect(() => testEvaluation(opts)).toThrowError(EvaluationError);
    try {
      testEvaluation(opts);
    } catch (error) {
      expect(error).toMatchObject({
        code: 'KONFIGURASI_TERKUNCI_TIDAK_ADA',
        exitCode: 4,
      });
    }

    validateEvaluation(opts);
    const split = readJson<SplitManifest>(join(opts.artifacts, 'split-manifest.json'));
    const testUnitId = split.units.test[0];
    expect(testUnitId).toBeDefined();

    const db = openDatabase(join(opts.workspace, 'evaluation.db'));
    try {
      const row = db
        .prepare('SELECT actual_sentence_days FROM case_unit WHERE id = ?')
        .get(testUnitId as string) as { actual_sentence_days: number };
      db.prepare('UPDATE case_unit SET actual_sentence_days = ? WHERE id = ?').run(
        row.actual_sentence_days + 30,
        testUnitId,
      );
    } finally {
      closeDatabase(db);
    }

    expect(() => testEvaluation(opts)).toThrowError(EvaluationError);
    try {
      testEvaluation(opts);
    } catch (error) {
      expect(error).toMatchObject({
        code: 'MANIFEST_TIDAK_COCOK',
        exitCode: 4,
      });
    }
  });

  it('proceeds when at least one candidate reaches the minimum estimate count', () => {
    const opts = options();
    prepareEvaluation(opts);

    const validated = validateEvaluation({ ...opts, minCandidateEstimates: 10 });
    expect(validated.status).toBe('validated');
    expect(validated.exitCode).toBe(0);
  });

  it('postpones tuning with exit code 3 when validation is too small', () => {
    const opts = options();
    prepareEvaluation(opts);

    const postponed = validateEvaluation({ ...opts, minValidationUnits: 999 });
    expect(postponed.status).toBe('postponed');
    expect(postponed.exitCode).toBe(3);
    expect(existsSync(join(opts.artifacts, EVALUATION_LOCK_FILE))).toBe(false);

    const report = readJson<{ status: string; reason: string; locked: boolean }>(
      join(opts.artifacts, 'validation-report.json'),
    );
    expect(report).toMatchObject({
      status: 'postponed',
      reason: 'validasi-terlalu-kecil',
      locked: false,
    });

    const tooFewEstimates = validateEvaluation({
      ...opts,
      minCandidateEstimates: 1000,
    });
    expect(tooFewEstimates.status).toBe('postponed');
    expect(tooFewEstimates.reason).toBe('estimasi-terlalu-sedikit');
  });

  it('keeps configuration selection and test predictions when only test targets change', () => {
    const first = prepareValidateTest();
    const firstLock = readJson<{ selected: { id: string }; configFingerprint: string }>(
      join(first.opts.artifacts, EVALUATION_LOCK_FILE),
    );
    const firstTest = readJson<{
      models: Array<{ id: string; predictionFingerprint: string }>;
    }>(join(first.opts.artifacts, EVALUATION_TEST_FILE));
    const firstUnitLines = readFileSync(
      join(first.opts.workspace, 'test-per-unit.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { unitId: string; actualSentenceDays: number });
    const firstSplit = readJson<SplitManifest>(
      join(first.opts.artifacts, 'split-manifest.json'),
    );

    const sourceB = join(directory, 'fixture-with-new-test-targets');
    cpSync(FIXTURE, sourceB, { recursive: true });
    rmSync(join(sourceB, 'manifest.json'));

    const db = openDatabase(join(first.opts.workspace, 'evaluation.db'));
    const testUnits: Array<{ id: string; days: number; path: string }> = [];
    try {
      for (const unitId of firstSplit.units.test) {
        const row = db
          .prepare(
            `SELECT cu.id, cu.actual_sentence_days AS days, sd.snapshot_path AS path
               FROM case_unit cu
               JOIN case_unit_source cus ON cus.case_unit_id = cu.id
               JOIN source_document sd ON sd.id = cus.source_document_id
              WHERE cu.id = ?`,
          )
          .get(unitId) as { id: string; days: number; path: string } | undefined;
        if (row !== undefined) {
          testUnits.push(row);
        }
      }
    } finally {
      closeDatabase(db);
    }
    expect(testUnits.length).toBeGreaterThan(0);

    for (const unit of testUnits) {
      const file = join(sourceB, 'dataset', unit.path.replace(/^dataset\//, ''));
      const xml = readFileSync(file, 'utf8');
      const newDays = unit.days + 30;
      const newMonths = newDays / 30;
      const updated = xml
        .replace(`lama_hukuman="${unit.days}"`, `lama_hukuman="${newDays}"`)
        .replace(
          /pidana penjara selama [^<]*?bulan/,
          `pidana penjara selama ${newMonths} bulan`,
        );
      expect(updated).not.toBe(xml);
      expect(updated).toContain(`lama_hukuman="${newDays}"`);
      writeFileSync(file, updated, 'utf8');
    }

    const second = prepareValidateTest({ sourceDir: sourceB });
    const secondLock = readJson<{ selected: { id: string }; configFingerprint: string }>(
      join(second.opts.artifacts, EVALUATION_LOCK_FILE),
    );
    const secondTest = readJson<{
      models: Array<{ id: string; predictionFingerprint: string }>;
    }>(join(second.opts.artifacts, EVALUATION_TEST_FILE));
    const secondSplit = readJson<SplitManifest>(
      join(second.opts.artifacts, 'split-manifest.json'),
    );

    expect(secondLock.selected.id).toBe(firstLock.selected.id);
    expect(secondLock.configFingerprint).toBe(firstLock.configFingerprint);
    expect(secondSplit.units).toEqual(firstSplit.units);
    expect(
      secondTest.models.map((model) => [model.id, model.predictionFingerprint]),
    ).toEqual(
      firstTest.models.map((model) => [model.id, model.predictionFingerprint]),
    );

    const firstActuals = new Map(
      firstUnitLines.map((line) => [line.unitId, line.actualSentenceDays]),
    );
    const secondUnitLines = readFileSync(
      join(second.opts.workspace, 'test-per-unit.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { unitId: string; actualSentenceDays: number });
    const changed = secondUnitLines.filter(
      (line) => firstActuals.get(line.unitId) !== line.actualSentenceDays,
    );
    expect(changed.length).toBeGreaterThan(0);
  });

  it('runs all stages through the dispatcher', () => {
    const opts = options();
    const result = runEvaluation({ ...opts, stage: 'all' });
    expect(result.status).toBe('tested');
    expect(result.exitCode).toBe(0);
    expect(result.stage).toBe('all');
    expect(existsSync(join(opts.artifacts, EVALUATION_TEST_FILE))).toBe(true);
  });
});
