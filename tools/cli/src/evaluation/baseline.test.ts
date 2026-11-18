import { describe, expect, it } from 'vitest';
import { baselineDaysFor, buildMedianBaseline, type BaselineUnit } from './baseline';

const training: BaselineUnit[] = [
  { id: 'T1', category: 'pencurian', actualSentenceDays: 100 },
  { id: 'T2', category: 'pencurian', actualSentenceDays: 200 },
  { id: 'T3', category: 'penggelapan', actualSentenceDays: 300 },
  { id: 'T4', category: null, actualSentenceDays: 400 },
];

describe('buildMedianBaseline', () => {
  it('computes the overall median from an even number of training outcomes', () => {
    const baseline = buildMedianBaseline(training);

    expect(baseline.overallMedianDays).toBe(250);
    expect(baseline.eligibleTrainingUnitCount).toBe(4);
    expect(baseline.trainingUnitCount).toBe(4);
  });

  it('computes the overall median from an odd number of training outcomes', () => {
    const baseline = buildMedianBaseline([
      ...training,
      { id: 'T5', category: 'penggelapan', actualSentenceDays: 500 },
    ]);

    expect(baseline.overallMedianDays).toBe(300);
  });

  it('computes category medians and falls back to the overall median', () => {
    const baseline = buildMedianBaseline(training);

    expect(baseline.categoryMedians).toEqual({ pencurian: 150, penggelapan: 300 });
    expect(baselineDaysFor(baseline, 'pencurian')).toBe(150);
    expect(baselineDaysFor(baseline, 'penggelapan')).toBe(300);
    expect(baselineDaysFor(baseline, 'kategori-tidak-dikenal')).toBe(250);
    expect(baselineDaysFor(baseline, null)).toBe(250);
    expect(baselineDaysFor(baseline, undefined)).toBe(250);
  });

  it('excludes unknown and non-positive outcomes from training medians', () => {
    const baseline = buildMedianBaseline([
      ...training,
      { id: 'T5', category: 'pencurian', actualSentenceDays: null },
      { id: 'T6', category: 'pencurian', actualSentenceDays: 0 },
    ]);

    expect(baseline.trainingUnitCount).toBe(6);
    expect(baseline.eligibleTrainingUnitCount).toBe(4);
    expect(baseline.categoryMedians.pencurian).toBe(150);
  });

  it('reports unavailable medians when training has no eligible outcome', () => {
    const baseline = buildMedianBaseline([
      { id: 'T1', category: 'pencurian', actualSentenceDays: null },
    ]);

    expect(baseline.overallMedianDays).toBeNull();
    expect(baseline.categoryMedians).toEqual({});
    expect(baseline.eligibleTrainingUnitCount).toBe(0);
    expect(baselineDaysFor(baseline, 'pencurian')).toBeNull();
  });

  it('does not read prototype properties as category medians', () => {
    const baseline = buildMedianBaseline([
      { id: 'T1', category: 'toString', actualSentenceDays: 200 },
      { id: 'T2', category: '__proto__', actualSentenceDays: 100 },
    ]);

    expect(baseline.overallMedianDays).toBe(150);
    expect(baselineDaysFor(baseline, 'toString')).toBe(200);
    expect(baselineDaysFor(baseline, '__proto__')).toBe(100);
    expect(baselineDaysFor(baseline, 'constructor')).toBe(150);
    expect(baselineDaysFor(baseline, 'hasOwnProperty')).toBe(150);
  });
});
