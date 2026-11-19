import { describe, expect, it } from 'vitest';
import { buildMedianBaseline } from './baseline';
import { evaluatePredictions, type EvaluationPrediction } from './metrics';

const training = buildMedianBaseline([
  { id: 'T1', category: 'pencurian', actualSentenceDays: 100 },
  { id: 'T2', category: 'pencurian', actualSentenceDays: 200 },
  { id: 'T3', category: 'penggelapan', actualSentenceDays: 300 },
  { id: 'T4', category: null, actualSentenceDays: 400 },
]);

const predictions: EvaluationPrediction[] = [
  { unitId: 'E1', category: 'pencurian', actualSentenceDays: 180, estimatedSentenceDays: 200 },
  { unitId: 'E2', category: 'pencurian', actualSentenceDays: 240, estimatedSentenceDays: 200 },
  {
    unitId: 'E3',
    category: 'penggelapan',
    actualSentenceDays: 480,
    estimatedSentenceDays: null,
    withheldReason: 'REFERENSI_TIDAK_CUKUP',
  },
  { unitId: 'E4', category: 'perampokan', actualSentenceDays: 120, estimatedSentenceDays: 100 },
  {
    unitId: 'E5',
    category: 'penipuan',
    actualSentenceDays: 60,
    estimatedSentenceDays: null,
    withheldReason: 'NARASI_TIDAK_TERBANDING',
  },
  {
    unitId: 'E6',
    category: null,
    actualSentenceDays: 90,
    estimatedSentenceDays: null,
  },
];

describe('evaluatePredictions', () => {
  it('reports accepted and withheld counts, coverage, and errors on accepted units', () => {
    const report = evaluatePredictions(predictions, training);

    expect(report.eligibleUnitCount).toBe(6);
    expect(report.acceptedUnitCount).toBe(3);
    expect(report.withheldUnitCount).toBe(3);
    expect(report.coverage).toEqual({
      status: 'available',
      value: 0.5,
      acceptedUnitCount: 3,
      eligibleUnitCount: 6,
    });
    expect(report.withheldReasons).toEqual([
      { reason: 'NARASI_TIDAK_TERBANDING', unitCount: 1 },
      { reason: 'REFERENSI_TIDAK_CUKUP', unitCount: 1 },
      { reason: null, unitCount: 1 },
    ]);

    expect(report.cbr.status).toBe('available');
    if (report.cbr.status === 'available') {
      expect(report.cbr.unitCount).toBe(3);
      expect(report.cbr.maeDays).toBeCloseTo(80 / 3);
      expect(report.cbr.rmseDays).toBeCloseTo(Math.sqrt(800));
      expect(report.cbr.medianAbsoluteErrorDays).toBe(20);
    }
  });

  it('compares the baseline on exactly the accepted units and on all eligible units', () => {
    const report = evaluatePredictions(predictions, training);

    expect(report.baselineOnAcceptedUnits).toMatchObject({ status: 'available', unitCount: 3 });
    if (report.baselineOnAcceptedUnits.status === 'available') {
      expect(report.baselineOnAcceptedUnits.maeDays).toBeCloseTo(250 / 3);
      expect(report.baselineOnAcceptedUnits.rmseDays).toBeCloseTo(Math.sqrt(25900 / 3));
      expect(report.baselineOnAcceptedUnits.medianAbsoluteErrorDays).toBe(90);
    }

    expect(report.baselineOnEligibleUnits).toMatchObject({ status: 'available', unitCount: 6 });
    if (report.baselineOnEligibleUnits.status === 'available') {
      expect(report.baselineOnEligibleUnits.maeDays).toBeCloseTo(130);
      expect(report.baselineOnEligibleUnits.rmseDays).toBeCloseTo(Math.sqrt(20000));
      expect(report.baselineOnEligibleUnits.medianAbsoluteErrorDays).toBe(145);
    }

    expect(report.overallMedianOnAcceptedUnits).toEqual({
      status: 'available',
      unitCount: 3,
      maeDays: 70,
      rmseDays: Math.sqrt(7300),
      medianAbsoluteErrorDays: 70,
    });
    expect(report.overallMedianOnEligibleUnits).toEqual({
      status: 'available',
      unitCount: 6,
      maeDays: 790 / 6,
      rmseDays: Math.sqrt(22750),
      medianAbsoluteErrorDays: 145,
    });
  });

  it('reports per-category blocks with their own set sizes', () => {
    const report = evaluatePredictions(predictions, training);

    expect(report.perCategory.map((category) => category.category)).toEqual([
      'pencurian',
      'penggelapan',
      'penipuan',
      'perampokan',
      null,
    ]);

    const pencurian = report.perCategory[0];
    expect(pencurian).toMatchObject({
      category: 'pencurian',
      eligibleUnitCount: 2,
      acceptedUnitCount: 2,
      withheldUnitCount: 0,
    });
    expect(pencurian?.coverage).toEqual({
      status: 'available',
      value: 1,
      acceptedUnitCount: 2,
      eligibleUnitCount: 2,
    });
    expect(pencurian?.cbr.status).toBe('available');
    if (pencurian?.cbr.status === 'available') {
      expect(pencurian.cbr.maeDays).toBe(30);
      expect(pencurian.cbr.rmseDays).toBeCloseTo(Math.sqrt(1000));
      expect(pencurian.cbr.medianAbsoluteErrorDays).toBe(30);
    }

    const penggelapan = report.perCategory[1];
    expect(penggelapan).toMatchObject({
      category: 'penggelapan',
      eligibleUnitCount: 1,
      acceptedUnitCount: 0,
      withheldUnitCount: 1,
    });
    expect(penggelapan?.coverage).toMatchObject({ status: 'available', value: 0 });
    expect(penggelapan?.cbr.status).toBe('unavailable');
    expect(penggelapan?.baselineOnAcceptedUnits.status).toBe('unavailable');
    expect(penggelapan?.baselineOnEligibleUnits).toMatchObject({
      status: 'available',
      unitCount: 1,
      maeDays: 180,
    });
  });

  it('marks metrics unavailable when the denominator is zero', () => {
    const allWithheld = evaluatePredictions(
      [
        {
          unitId: 'W1',
          category: 'pencurian',
          actualSentenceDays: 120,
          estimatedSentenceDays: null,
          withheldReason: 'REFERENSI_TIDAK_CUKUP',
        },
      ],
      training,
    );

    expect(allWithheld.coverage).toEqual({
      status: 'available',
      value: 0,
      acceptedUnitCount: 0,
      eligibleUnitCount: 1,
    });
    expect(allWithheld.cbr).toMatchObject({ status: 'unavailable', unitCount: 0 });
    expect(allWithheld.baselineOnAcceptedUnits).toMatchObject({
      status: 'unavailable',
      unitCount: 0,
    });
    expect(allWithheld.baselineOnEligibleUnits).toMatchObject({
      status: 'available',
      unitCount: 1,
      maeDays: 30,
    });

    const empty = evaluatePredictions([], training);
    expect(empty.eligibleUnitCount).toBe(0);
    expect(empty.coverage.status).toBe('unavailable');
    expect(empty.cbr.status).toBe('unavailable');
    expect(empty.baselineOnAcceptedUnits.status).toBe('unavailable');
    expect(empty.baselineOnEligibleUnits.status).toBe('unavailable');
    expect(empty.perCategory).toEqual([]);
  });

  it('excludes units without a known positive outcome from every set', () => {
    const report = evaluatePredictions(
      [
        { unitId: 'U1', category: 'pencurian', actualSentenceDays: null, estimatedSentenceDays: 100 },
        { unitId: 'U2', category: 'pencurian', actualSentenceDays: 0, estimatedSentenceDays: 100 },
      ],
      training,
    );

    expect(report.eligibleUnitCount).toBe(0);
    expect(report.acceptedUnitCount).toBe(0);
    expect(report.coverage.status).toBe('unavailable');
  });

  it('keeps CBR metrics available when the training baseline is unavailable', () => {
    const noBaseline = buildMedianBaseline([]);
    const report = evaluatePredictions(
      [{ unitId: 'E1', category: 'pencurian', actualSentenceDays: 180, estimatedSentenceDays: 200 }],
      noBaseline,
    );

    expect(report.coverage).toMatchObject({ status: 'available', value: 1 });
    expect(report.cbr).toMatchObject({ status: 'available', unitCount: 1, maeDays: 20 });
    expect(report.baselineOnAcceptedUnits.status).toBe('unavailable');
    expect(report.baselineOnEligibleUnits.status).toBe('unavailable');
    expect(report.overallMedianOnAcceptedUnits.status).toBe('unavailable');
    expect(report.overallMedianOnEligibleUnits.status).toBe('unavailable');
  });

  it('rejects duplicate units and invalid day values', () => {
    expect(() =>
      evaluatePredictions(
        [
          { unitId: 'E1', actualSentenceDays: 180, estimatedSentenceDays: 200 },
          { unitId: 'E1', actualSentenceDays: 180, estimatedSentenceDays: 200 },
        ],
        training,
      ),
    ).toThrow(/duplikat/);

    expect(() =>
      evaluatePredictions([{ unitId: 'E1', actualSentenceDays: -1 }], training),
    ).toThrow(/tidak negatif/);
    expect(() =>
      evaluatePredictions([{ unitId: 'E1', actualSentenceDays: 10, estimatedSentenceDays: -1 }], training),
    ).toThrow(/tidak negatif/);
    expect(() =>
      evaluatePredictions([{ unitId: 'E1', actualSentenceDays: Number.NaN }], training),
    ).toThrow(/tidak negatif/);
  });
});
