import { describe, expect, it } from 'vitest';
import { buildMedianBaseline } from './baseline';
import { evaluatePredictions, type EvaluationPrediction } from './metrics';
import { buildSplitManifest, type SplitUnit } from './split';

/**
 * Small synthetic fixture with hand-calculated answers.
 *
 * Case groups:
 * - two defendants in one case: D1 and D2
 * - one withheld estimate: D3
 * - one report group without any estimate: D4 and D5
 */
const training = buildMedianBaseline([
  { id: 'T1', category: 'pencurian', actualSentenceDays: 100 },
  { id: 'T2', category: 'pencurian', actualSentenceDays: 200 },
  { id: 'T3', category: 'penggelapan', actualSentenceDays: 300 },
  { id: 'T4', category: null, actualSentenceDays: 400 },
]);

const predictions: EvaluationPrediction[] = [
  { unitId: 'D1', category: 'pencurian', actualSentenceDays: 180, estimatedSentenceDays: 200 },
  { unitId: 'D2', category: 'pencurian', actualSentenceDays: 240, estimatedSentenceDays: 200 },
  {
    unitId: 'D3',
    category: 'penggelapan',
    actualSentenceDays: 480,
    estimatedSentenceDays: null,
    withheldReason: 'REFERENSI_TIDAK_CUKUP',
  },
  {
    unitId: 'D4',
    category: 'penipuan',
    actualSentenceDays: 60,
    estimatedSentenceDays: null,
    withheldReason: 'NARASI_TIDAK_TERBANDING',
  },
  {
    unitId: 'D5',
    category: 'penipuan',
    actualSentenceDays: 30,
    estimatedSentenceDays: null,
    withheldReason: 'NARASI_TIDAK_TERBANDING',
  },
  {
    unitId: 'D6',
    category: null,
    actualSentenceDays: 90,
    estimatedSentenceDays: null,
    withheldReason: 'NARASI_TIDAK_TERBANDING',
  },
];

const groupByUnit: Record<string, string> = {
  D1: 'case-1',
  D2: 'case-1',
  D3: 'case-2',
  D4: 'case-3',
  D5: 'case-3',
  D6: 'case-4',
  T1: 'train-1',
  T2: 'train-2',
  T3: 'train-3',
  T4: 'train-4',
};

const splitUnits: SplitUnit[] = Object.entries(groupByUnit).map(([id, caseGroupId]) => ({
  id,
  caseGroupId,
}));

describe('synthetic evaluation fixture', () => {
  it('keeps the two defendants and the report group together in one split', () => {
    const manifest = buildSplitManifest(splitUnits, {
      seed: 'fixture-24',
      proportions: { training: 0.6, validation: 0.2, test: 0.2 },
    });
    const assignments = new Map(
      manifest.assignments.map((assignment) => [assignment.id, assignment.split]),
    );

    expect(manifest.assignments).toHaveLength(splitUnits.length);
    expect(new Set(manifest.assignments.map((assignment) => assignment.id)).size).toBe(
      splitUnits.length,
    );
    expect(assignments.get('D1')).toBe(assignments.get('D2'));
    expect(assignments.get('D4')).toBe(assignments.get('D5'));

    const groupOf = new Map(splitUnits.map((unit) => [unit.id, unit.caseGroupId]));
    expect(groupOf.get('D3')).not.toBe(groupOf.get('D4'));
  });

  it('computes the training medians by hand', () => {
    expect(training.overallMedianDays).toBe(250);
    expect(training.categoryMedians).toEqual({ pencurian: 150, penggelapan: 300 });
  });

  it('computes counts, coverage, errors, and both baseline comparisons by hand', () => {
    const report = evaluatePredictions(predictions, training);

    expect(report.eligibleUnitCount).toBe(6);
    expect(report.acceptedUnitCount).toBe(2);
    expect(report.withheldUnitCount).toBe(4);
    expect(report.coverage).toEqual({
      status: 'available',
      value: 1 / 3,
      acceptedUnitCount: 2,
      eligibleUnitCount: 6,
    });
    expect(report.withheldReasons).toEqual([
      { reason: 'NARASI_TIDAK_TERBANDING', unitCount: 3 },
      { reason: 'REFERENSI_TIDAK_CUKUP', unitCount: 1 },
    ]);

    expect(report.cbr).toMatchObject({
      status: 'available',
      unitCount: 2,
      maeDays: 30,
      medianAbsoluteErrorDays: 30,
    });
    if (report.cbr.status === 'available') {
      expect(report.cbr.rmseDays).toBeCloseTo(Math.sqrt(1000));
    }

    expect(report.baselineOnAcceptedUnits).toMatchObject({
      status: 'available',
      unitCount: 2,
      maeDays: 60,
      medianAbsoluteErrorDays: 60,
    });
    if (report.baselineOnAcceptedUnits.status === 'available') {
      expect(report.baselineOnAcceptedUnits.rmseDays).toBeCloseTo(Math.sqrt(4500));
    }

    expect(report.baselineOnEligibleUnits).toMatchObject({
      status: 'available',
      unitCount: 6,
      maeDays: 145,
      medianAbsoluteErrorDays: 170,
    });
    if (report.baselineOnEligibleUnits.status === 'available') {
      expect(report.baselineOnEligibleUnits.rmseDays).toBeCloseTo(Math.sqrt(25250));
    }
  });

  it('reports an unavailable metric for the category with no accepted estimate', () => {
    const report = evaluatePredictions(predictions, training);

    expect(report.perCategory.map((category) => category.category)).toEqual([
      'pencurian',
      'penggelapan',
      'penipuan',
      null,
    ]);

    const penggelapan = report.perCategory.find((category) => category.category === 'penggelapan');
    expect(penggelapan).toMatchObject({
      eligibleUnitCount: 1,
      acceptedUnitCount: 0,
      withheldUnitCount: 1,
    });
    expect(penggelapan?.coverage).toMatchObject({ status: 'available', value: 0 });
    expect(penggelapan?.cbr.status).toBe('unavailable');

    const penipuan = report.perCategory.find((category) => category.category === 'penipuan');
    expect(penipuan).toMatchObject({
      eligibleUnitCount: 2,
      acceptedUnitCount: 0,
      withheldUnitCount: 2,
    });
    expect(penipuan?.baselineOnEligibleUnits).toMatchObject({
      status: 'available',
      unitCount: 2,
      maeDays: 205,
    });
  });
});
