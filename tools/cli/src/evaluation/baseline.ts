/**
 * Simple median baselines for the evaluation.
 *
 * The baseline is deliberately simple: the median training outcome overall and
 * per category. A category that is absent from training (or a unit without a
 * category) falls back to the overall median. A missing baseline is reported as
 * `null`; it is never silently replaced by zero.
 */

import { compareIds, isPositiveFinite, median, normalizeCategory } from './common';

export interface BaselineUnit {
  /** Stable case-unit ID from the domain model. */
  id: string;
  /** Category of conduct known before the verdict, when available. */
  category?: string | null;
  /**
   * Actual outcome in days. Only positive, finite values are eligible:
   * the evaluation target is positive term imprisonment, so a known 0-day
   * non-custodial outcome is outside this coverage.
   */
  actualSentenceDays?: number | null;
}

export interface MedianBaseline {
  /** Overall median of eligible training outcomes, or null when none exist. */
  overallMedianDays: number | null;
  /** Median per category, sorted by category name. */
  categoryMedians: Record<string, number>;
  /** All training units supplied, including ineligible ones. */
  trainingUnitCount: number;
  /** Training units with a positive, finite actual outcome. */
  eligibleTrainingUnitCount: number;
}

export function buildMedianBaseline(units: readonly BaselineUnit[]): MedianBaseline {
  const outcomes: number[] = [];
  const byCategory = new Map<string, number[]>();

  for (const unit of units) {
    if (!isPositiveFinite(unit.actualSentenceDays)) {
      continue;
    }

    outcomes.push(unit.actualSentenceDays);
    const category = normalizeCategory(unit.category);
    if (category !== null) {
      const values = byCategory.get(category);
      if (values === undefined) {
        byCategory.set(category, [unit.actualSentenceDays]);
      } else {
        values.push(unit.actualSentenceDays);
      }
    }
  }

  // Object.fromEntries creates own data properties, so category names such as
  // "__proto__" or "toString" cannot leak prototype values into the baseline.
  const categoryMedians = Object.fromEntries(
    [...byCategory.keys()]
      .sort(compareIds)
      .map((category) => [category, median(byCategory.get(category) as number[])]),
  ) as Record<string, number>;

  return {
    overallMedianDays: outcomes.length === 0 ? null : median(outcomes),
    categoryMedians,
    trainingUnitCount: units.length,
    eligibleTrainingUnitCount: outcomes.length,
  };
}

export function baselineDaysFor(
  baseline: MedianBaseline,
  category: string | null | undefined,
): number | null {
  const normalized = normalizeCategory(category);
  if (
    normalized !== null &&
    Object.prototype.hasOwnProperty.call(baseline.categoryMedians, normalized)
  ) {
    return baseline.categoryMedians[normalized] as number;
  }
  return baseline.overallMedianDays;
}
