import { describe, expect, it } from 'vitest';
import type { EvaluationReport } from './metrics';
import { selectValidationCandidate, type CandidateEvaluation } from './selection';

function report(input: {
  coverage: number | null;
  mae: number | null;
  eligibleUnitCount?: number;
}): EvaluationReport {
  const eligible = input.eligibleUnitCount ?? 100;
  const accepted =
    input.coverage === null ? 0 : Math.round(input.coverage * eligible);
  return {
    eligibleUnitCount: eligible,
    acceptedUnitCount: accepted,
    withheldUnitCount: eligible - accepted,
    coverage:
      input.coverage === null
        ? {
            status: 'unavailable',
            reason: 'test',
            acceptedUnitCount: 0,
            eligibleUnitCount: 0,
          }
        : {
            status: 'available',
            value: input.coverage,
            acceptedUnitCount: accepted,
            eligibleUnitCount: eligible,
          },
    cbr:
      input.mae === null
        ? { status: 'unavailable', unitCount: 0, reason: 'test' }
        : {
            status: 'available',
            unitCount: accepted,
            maeDays: input.mae,
            rmseDays: input.mae,
            medianAbsoluteErrorDays: input.mae,
          },
    baselineOnAcceptedUnits: {
      status: 'unavailable',
      unitCount: 0,
      reason: 'test',
    },
    baselineOnEligibleUnits: {
      status: 'unavailable',
      unitCount: 0,
      reason: 'test',
    },
    overallMedianOnAcceptedUnits: { status: 'unavailable', unitCount: 0, reason: 'test' },
    overallMedianOnEligibleUnits: { status: 'unavailable', unitCount: 0, reason: 'test' },
    withheldReasons: [],
    perCategory: [],
  };
}

function candidate(
  gridIndex: number,
  coverage: number | null,
  mae: number | null,
): CandidateEvaluation {
  return {
    id: `kandidat-${String(gridIndex).padStart(2, '0')}`,
    gridIndex,
    report: report({ coverage, mae }),
    estimatedUnitCount:
      coverage === null ? 0 : Math.round(coverage * 100),
    eligibleUnitCount: 100,
  };
}

describe('validation selection rule', () => {
  it('prefers the lowest MAE among candidates that reach the coverage target', () => {
    const result = selectValidationCandidate(
      [
        candidate(0, 0.91, 100),
        candidate(1, 0.92, 120),
        candidate(2, 0.89, 10),
      ],
      0.9,
    );

    expect(result.targetMet).toBe(true);
    expect(result.rule).toBe('coverage-target-achieved');
    expect(result.selected.id).toBe('kandidat-00');
  });

  it('breaks an MAE tie with the highest coverage, then the grid order', () => {
    const byCoverage = selectValidationCandidate(
      [candidate(0, 0.9, 100), candidate(1, 0.95, 100)],
      0.9,
    );
    expect(byCoverage.selected.id).toBe('kandidat-01');

    const byOrder = selectValidationCandidate(
      [candidate(5, 0.92, 100), candidate(3, 0.92, 100)],
      0.9,
    );
    expect(byOrder.selected.id).toBe('kandidat-03');
  });

  it('falls back to coverage, then MAE, then grid order when the target is missed', () => {
    const result = selectValidationCandidate(
      [candidate(0, 0.7, 50), candidate(1, 0.8, 90), candidate(2, 0.8, 80)],
      0.9,
    );

    expect(result.targetMet).toBe(false);
    expect(result.rule).toBe('coverage-target-not-achieved');
    expect(result.selected.id).toBe('kandidat-02');
  });

  it('never selects a candidate with no usable metric when one is available', () => {
    const result = selectValidationCandidate(
      [candidate(0, null, null), candidate(1, 0.5, 200)],
      0.9,
    );
    expect(result.selected.id).toBe('kandidat-01');
  });
});
