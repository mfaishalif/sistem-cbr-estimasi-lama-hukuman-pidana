/**
 * Validation selection rule from the configuration decision.
 *
 * Among candidates that reach the coverage target, the lowest MAE wins; ties
 * go to the highest coverage and then to the grid order. When no candidate
 * reaches the target, the highest coverage wins, then the lowest MAE, then the
 * grid order. Nothing here looks at test data.
 */

import type { EvaluationReport } from './metrics';

export interface CandidateEvaluation {
  id: string;
  gridIndex: number;
  report: EvaluationReport;
  /** Eligible validation units that received an estimate. */
  estimatedUnitCount: number;
  eligibleUnitCount: number;
}

export interface CandidateScore {
  candidate: CandidateEvaluation;
  coverage: number;
  /** Lower is better; `Infinity` only when no estimate was accepted. */
  maeDays: number;
}

export type SelectionRule =
  | 'coverage-target-achieved'
  | 'coverage-target-not-achieved';

export interface SelectionResult {
  selected: CandidateEvaluation;
  targetMet: boolean;
  rule: SelectionRule;
  scores: CandidateScore[];
}

function coverageOf(candidate: CandidateEvaluation): number {
  const coverage = candidate.report.coverage;
  return coverage.status === 'available' ? coverage.value : 0;
}

function maeOf(candidate: CandidateEvaluation): number {
  const cbr = candidate.report.cbr;
  return cbr.status === 'available' ? cbr.maeDays : Number.POSITIVE_INFINITY;
}

function score(candidate: CandidateEvaluation): CandidateScore {
  return {
    candidate,
    coverage: coverageOf(candidate),
    maeDays: maeOf(candidate),
  };
}

function compareTargetAchieved(left: CandidateScore, right: CandidateScore): number {
  return (
    left.maeDays - right.maeDays ||
    right.coverage - left.coverage ||
    left.candidate.gridIndex - right.candidate.gridIndex
  );
}

function compareTargetMissed(left: CandidateScore, right: CandidateScore): number {
  return (
    right.coverage - left.coverage ||
    left.maeDays - right.maeDays ||
    left.candidate.gridIndex - right.candidate.gridIndex
  );
}

export function selectValidationCandidate(
  candidates: readonly CandidateEvaluation[],
  coverageTarget: number,
): SelectionResult {
  if (candidates.length === 0) {
    throw new Error('Pemilihan konfigurasi memerlukan minimal satu kandidat.');
  }

  const scores = candidates.map(score);
  const reachingTarget = scores.filter((entry) => entry.coverage >= coverageTarget);
  const targetMet = reachingTarget.length > 0;
  const ordered = [...(targetMet ? reachingTarget : scores)].sort(
    targetMet ? compareTargetAchieved : compareTargetMissed,
  );

  return {
    selected: (ordered[0] as CandidateScore).candidate,
    targetMet,
    rule: targetMet ? 'coverage-target-achieved' : 'coverage-target-not-achieved',
    scores,
  };
}
