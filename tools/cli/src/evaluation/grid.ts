/**
 * The approved validation grid from the configuration decision.
 *
 * The grid is enumerated outer-to-inner exactly as agreed: component weights,
 * `k`, minimum references, minimum score, then minimum attribute coverage.
 * Grid order is the final deterministic tie-break, so it must not change
 * without recording a new experiment protocol.
 */

import {
  DEFAULT_RETRIEVAL_CONFIG,
  resolveRetrievalConfig,
  retrievalConfigFingerprint,
  type RetrievalConfig,
} from '@cbr/core';
import type { SplitProportions } from './split';

export const EVALUATION_SEED = 'indo-law-cbr-v1';

/** Bump when the candidate grid or its selection protocol changes. */
export const EVALUATION_GRID_PROTOCOL = 1;

export const EVALUATION_PROPORTIONS: SplitProportions = {
  training: 0.7,
  validation: 0.15,
  test: 0.15,
};

/** Coverage target from the configuration decision. */
export const EVALUATION_COVERAGE_TARGET = 0.9;

/** Minimum validation size before tuning may run (production defaults). */
export const EVALUATION_MIN_VALIDATION_UNITS = 100;
export const EVALUATION_MIN_VALIDATION_GROUPS = 50;
export const EVALUATION_MIN_CANDIDATE_ESTIMATES = 50;

export const EVALUATION_WEIGHTS = [
  { narrativeWeight: 0.75, articleWeight: 0.2, attributeGroupWeight: 0.05 },
  { narrativeWeight: 0.85, articleWeight: 0.1, attributeGroupWeight: 0.05 },
] as const;

export const EVALUATION_MAX_REFERENCES = [3, 5] as const;
export const EVALUATION_MIN_REFERENCES = [1, 2] as const;
export const EVALUATION_MIN_SCORES = [0.05, 0.1] as const;
export const EVALUATION_MIN_ATTRIBUTE_COVERAGES = [0.7, 0.85] as const;

/**
 * Frozen preprocessing from the decision: NFKC-style lowercasing, Unicode
 * letter/number unigrams, document frequency of at least two, raw term
 * frequency, and smoothed IDF ln((1+N)/(1+df)) + 1.
 */
export const EVALUATION_PREPROCESSING = {
  minTokenLength: 1,
  stopwords: [],
  minDocumentFrequency: 2,
  sublinearTermFrequency: false,
  smoothInverseDocumentFrequency: true,
} as const;

export interface EvaluationCandidate {
  /** Zero-based enumeration position in the approved grid. */
  gridIndex: number;
  id: string;
  narrativeWeight: number;
  articleWeight: number;
  attributeGroupWeight: number;
  maxReferences: number;
  minReferences: number;
  minScore: number;
  minAttributeCoverage: number;
  config: RetrievalConfig;
  configFingerprint: string;
}

export interface CandidatesOptions {
  /** Override the approved preprocessing, used only by explicit experiments. */
  preprocessing?: Partial<RetrievalConfig['preprocessing']>;
}

function candidateId(gridIndex: number): string {
  return `kandidat-${String(gridIndex).padStart(2, '0')}`;
}

/**
 * Enumerate the approved 32-combination grid. Enumeration order is part of the
 * protocol: weights (outer), k, minimum references, minimum score, minimum
 * attribute coverage (inner).
 */
export function buildEvaluationCandidates(
  options: CandidatesOptions = {},
): EvaluationCandidate[] {
  const candidates: EvaluationCandidate[] = [];
  let gridIndex = 0;

  for (const weights of EVALUATION_WEIGHTS) {
    for (const maxReferences of EVALUATION_MAX_REFERENCES) {
      for (const minReferences of EVALUATION_MIN_REFERENCES) {
        for (const minScore of EVALUATION_MIN_SCORES) {
          for (const minAttributeCoverage of EVALUATION_MIN_ATTRIBUTE_COVERAGES) {
            const config = resolveRetrievalConfig({
              preprocessing: {
                ...EVALUATION_PREPROCESSING,
                ...options.preprocessing,
              },
              components: {
                narrativeWeight: weights.narrativeWeight,
                articleWeight: weights.articleWeight,
                attributes: [...DEFAULT_RETRIEVAL_CONFIG.components.attributes],
                attributeGroupWeight: weights.attributeGroupWeight,
              },
              categoryRestriction: 'when-known',
              retrieval: {
                maxReferences,
                minReferences,
                minScore,
                minAttributeCoverage,
              },
              rounding: 'nearest-day-half-up',
            });

            candidates.push({
              gridIndex,
              id: candidateId(gridIndex),
              narrativeWeight: weights.narrativeWeight,
              articleWeight: weights.articleWeight,
              attributeGroupWeight: weights.attributeGroupWeight,
              maxReferences,
              minReferences,
              minScore,
              minAttributeCoverage,
              config,
              configFingerprint: retrievalConfigFingerprint(config),
            });
            gridIndex += 1;
          }
        }
      }
    }
  }

  return candidates;
}

/**
 * The narration-only component variant: the same locked limits and
 * preprocessing, with weights 1/0/0 and weighted Reuse.
 */
export function buildNarrationOnlyConfig(locked: RetrievalConfig): RetrievalConfig {
  return resolveRetrievalConfig({
    preprocessing: {
      ...locked.preprocessing,
      stopwords: [...locked.preprocessing.stopwords],
    },
    components: {
      narrativeWeight: 1,
      articleWeight: 0,
      attributes: [],
    },
    categoryRestriction: locked.categoryRestriction,
    retrieval: { ...locked.retrieval },
    rounding: locked.rounding,
  });
}

/** Structure-only key: retrieval limits do not change a built index. */
export function indexStructureKey(config: RetrievalConfig): string {
  return JSON.stringify({
    preprocessing: config.preprocessing,
    narrativeWeight: config.components.narrativeWeight,
    articleWeight: config.components.articleWeight,
    attributes: config.components.attributes,
    attributeGroupWeight: config.components.attributeGroupWeight ?? null,
    categoryRestriction: config.categoryRestriction,
  });
}
