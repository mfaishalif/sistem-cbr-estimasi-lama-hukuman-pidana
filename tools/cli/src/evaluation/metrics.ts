/**
 * Outcome metrics for the CBR evaluation.
 *
 * Accuracy metrics are calculated only on units that have a positive actual
 * outcome and an estimate. A zero denominator is never reported as 0 or NaN;
 * it becomes an explicit `unavailable` metric so the caller can stop or report
 * the limitation. Coverage is always reported alongside the counts it uses.
 */

import { baselineDaysFor, type MedianBaseline } from './baseline';
import {
  assertUniqueUnitIds,
  compareNullLast,
  isPositiveFinite,
  median,
  normalizeCategory,
} from './common';

export interface EvaluationPrediction {
  /** Stable case-unit ID from the domain model. */
  unitId: string;
  /** Category of conduct known before the verdict, when available. */
  category?: string | null;
  /** Actual outcome in days. Null means unknown; the unit is then ineligible. */
  actualSentenceDays?: number | null;
  /** Estimate in days. Null means the estimate was withheld. */
  estimatedSentenceDays?: number | null;
  /** Machine reason when the estimate was withheld (estimasi ditahan). */
  withheldReason?: string | null;
}

export interface ErrorMetricsAvailable {
  status: 'available';
  unitCount: number;
  maeDays: number;
  rmseDays: number;
  medianAbsoluteErrorDays: number;
}

export interface ErrorMetricsUnavailable {
  status: 'unavailable';
  unitCount: 0;
  reason: string;
}

export type ErrorMetrics = ErrorMetricsAvailable | ErrorMetricsUnavailable;

export interface CoverageAvailable {
  status: 'available';
  /** Accepted estimates divided by eligible units, in the range 0..1. */
  value: number;
  acceptedUnitCount: number;
  eligibleUnitCount: number;
}

export interface CoverageUnavailable {
  status: 'unavailable';
  reason: string;
  acceptedUnitCount: 0;
  eligibleUnitCount: 0;
}

export type Coverage = CoverageAvailable | CoverageUnavailable;

export interface WithheldReasonCount {
  reason: string | null;
  unitCount: number;
}

export interface EvaluationBlock {
  eligibleUnitCount: number;
  acceptedUnitCount: number;
  withheldUnitCount: number;
  coverage: Coverage;
  /** Errors of the CBR estimates on accepted units. */
  cbr: ErrorMetrics;
  /** Baseline errors on exactly the accepted units, for a direct comparison. */
  baselineOnAcceptedUnits: ErrorMetrics;
  /** Baseline errors on every eligible unit, including withheld estimates. */
  baselineOnEligibleUnits: ErrorMetrics;
  /** Withheld estimates grouped by machine reason; null = no reason given. */
  withheldReasons: WithheldReasonCount[];
}

export interface CategoryEvaluation extends EvaluationBlock {
  /** Normalized category; null groups units without a category. */
  category: string | null;
}

export interface EvaluationReport extends EvaluationBlock {
  /** One block per category present in the eligible units, null last. */
  perCategory: CategoryEvaluation[];
}

type EligiblePrediction = EvaluationPrediction & { actualSentenceDays: number };
type AcceptedPrediction = EligiblePrediction & { estimatedSentenceDays: number };

function assertFiniteNonNegative(
  value: number | null | undefined,
  label: string,
): void {
  if (value === null || value === undefined) {
    return;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} harus berupa angka tidak negatif atau null.`);
  }
}

function isEligible(prediction: EvaluationPrediction): prediction is EligiblePrediction {
  return isPositiveFinite(prediction.actualSentenceDays);
}

function hasEstimate(prediction: EvaluationPrediction): prediction is AcceptedPrediction {
  const estimate = prediction.estimatedSentenceDays;
  return typeof estimate === 'number' && Number.isFinite(estimate);
}

function errorMetrics(errors: readonly number[], unavailableReason: string): ErrorMetrics {
  if (errors.length === 0) {
    return { status: 'unavailable', unitCount: 0, reason: unavailableReason };
  }

  const count = errors.length;
  const sum = errors.reduce((total, error) => total + error, 0);
  const sumOfSquares = errors.reduce((total, error) => total + error * error, 0);

  return {
    status: 'available',
    unitCount: count,
    maeDays: sum / count,
    rmseDays: Math.sqrt(sumOfSquares / count),
    medianAbsoluteErrorDays: median(errors),
  };
}

function baselineErrors(
  units: readonly EligiblePrediction[],
  baseline: MedianBaseline,
): number[] {
  const errors: number[] = [];
  for (const unit of units) {
    const prediction = baselineDaysFor(baseline, unit.category);
    if (prediction !== null) {
      errors.push(Math.abs(unit.actualSentenceDays - prediction));
    }
  }
  return errors;
}

function buildBlock(
  eligibleUnits: readonly EligiblePrediction[],
  baseline: MedianBaseline,
): EvaluationBlock {
  const accepted = eligibleUnits.filter(hasEstimate);
  const withheld = eligibleUnits.filter((unit) => !hasEstimate(unit));

  const cbrErrors = accepted.map((unit) =>
    Math.abs(unit.actualSentenceDays - unit.estimatedSentenceDays),
  );

  const baselineUnavailableReason =
    baseline.overallMedianDays === null
      ? 'Median training tidak tersedia, sehingga pembanding tidak dapat dihitung.'
      : 'Tidak ada unit yang memiliki hasil aktual dan pembanding.';

  const reasonCounts = new Map<string | null, number>();
  for (const unit of withheld) {
    const reason = unit.withheldReason ?? null;
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  const withheldReasons = [...reasonCounts.entries()]
    .map(([reason, unitCount]) => ({ reason, unitCount }))
    .sort((left, right) => compareNullLast(left.reason, right.reason));

  const coverage: Coverage =
    eligibleUnits.length === 0
      ? {
          status: 'unavailable',
          reason: 'Tidak ada unit layak, sehingga cakupan tidak dapat dihitung.',
          acceptedUnitCount: 0,
          eligibleUnitCount: 0,
        }
      : {
          status: 'available',
          value: accepted.length / eligibleUnits.length,
          acceptedUnitCount: accepted.length,
          eligibleUnitCount: eligibleUnits.length,
        };

  return {
    eligibleUnitCount: eligibleUnits.length,
    acceptedUnitCount: accepted.length,
    withheldUnitCount: withheld.length,
    coverage,
    cbr: errorMetrics(
      cbrErrors,
      'Tidak ada estimasi pada unit layak, sehingga metrik tidak dapat dihitung.',
    ),
    baselineOnAcceptedUnits: errorMetrics(
      baselineErrors(accepted, baseline),
      baselineUnavailableReason,
    ),
    baselineOnEligibleUnits: errorMetrics(
      baselineErrors(eligibleUnits, baseline),
      baselineUnavailableReason,
    ),
    withheldReasons,
  };
}

function validatePredictions(predictions: readonly EvaluationPrediction[]): void {
  assertUniqueUnitIds(
    predictions.map((prediction) => prediction.unitId),
    'ID unit prediksi',
  );

  for (const prediction of predictions) {
    assertFiniteNonNegative(prediction.actualSentenceDays, `Hasil aktual ${prediction.unitId}`);
    assertFiniteNonNegative(prediction.estimatedSentenceDays, `Estimasi ${prediction.unitId}`);
  }
}

export function evaluatePredictions(
  predictions: readonly EvaluationPrediction[],
  baseline: MedianBaseline,
): EvaluationReport {
  validatePredictions(predictions);

  const eligible = predictions.filter(isEligible);
  const byCategory = new Map<string | null, EligiblePrediction[]>();
  for (const unit of eligible) {
    const category = normalizeCategory(unit.category);
    const members = byCategory.get(category);
    if (members === undefined) {
      byCategory.set(category, [unit]);
    } else {
      members.push(unit);
    }
  }

  const perCategory: CategoryEvaluation[] = [...byCategory.entries()]
    .map(([category, units]) => ({ category, ...buildBlock(units, baseline) }))
    .sort((left, right) => compareNullLast(left.category, right.category));

  return {
    ...buildBlock(eligible, baseline),
    perCategory,
  };
}
