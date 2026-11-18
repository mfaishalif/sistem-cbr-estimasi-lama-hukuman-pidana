/**
 * Reuse: weighted average of actual outcomes of retrieved references.
 *
 * estimate = Σ(score × actualSentenceDays) / Σ(score)
 *
 * Similar cases therefore carry more influence. There is no manual add/subtract
 * rule, no detention reduction, and no fine substitution.
 */

export interface ReuseReference {
  caseUnitId: string;
  score: number;
  actualSentenceDays: number;
}

export interface ReuseComputation {
  status: 'available' | 'withheld';
  rawDays: number | null;
  days: number | null;
  numerator: number | null;
  denominator: number | null;
  rounding: 'nearest-day-half-up';
  reason: 'NO_REFERENCES' | 'ZERO_WEIGHT' | null;
}

export function roundNearestDayHalfUp(value: number): number {
  // JavaScript Math.round rounds positive half values up and preserves the
  // nearest-day rule for the positive day values this engine produces.
  return Math.round(value);
}

export function computeWeightedReuse(
  references: readonly ReuseReference[],
): ReuseComputation {
  if (references.length === 0) {
    return {
      status: 'withheld',
      rawDays: null,
      days: null,
      numerator: null,
      denominator: null,
      rounding: 'nearest-day-half-up',
      reason: 'NO_REFERENCES',
    };
  }

  let numerator = 0;
  let denominator = 0;
  for (const reference of references) {
    if (!Number.isFinite(reference.score) || reference.score <= 0) {
      throw new Error(`reference ${reference.caseUnitId} must have a positive finite score`);
    }
    if (
      !Number.isFinite(reference.actualSentenceDays) ||
      reference.actualSentenceDays <= 0
    ) {
      throw new Error(
        `reference ${reference.caseUnitId} must have a positive finite actual outcome`,
      );
    }
    numerator += reference.score * reference.actualSentenceDays;
    denominator += reference.score;
  }

  if (denominator <= 0) {
    return {
      status: 'withheld',
      rawDays: null,
      days: null,
      numerator: null,
      denominator: null,
      rounding: 'nearest-day-half-up',
      reason: 'ZERO_WEIGHT',
    };
  }

  const rawDays = numerator / denominator;
  return {
    status: 'available',
    rawDays,
    days: roundNearestDayHalfUp(rawDays),
    numerator,
    denominator,
    rounding: 'nearest-day-half-up',
    reason: null,
  };
}
