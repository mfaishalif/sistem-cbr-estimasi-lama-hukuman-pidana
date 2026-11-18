/**
 * Retrieval index construction.
 *
 * The index is derived data: case facts, the fitted TF-IDF vocabulary/IDF, the
 * numeric scales, the inverted postings, and document norms. It never stores a
 * second copy of the actual outcome as authoritative data; outcomes are
 * snapshotted here only so one estimate uses one consistent generation.
 */

import {
  extractAttribute,
  fitNumericScales,
  normalizeCategoryName,
  articleReferences,
  type ExtractedAttribute,
  type NumericScales,
} from './attributes';
import {
  retrievalConfigFingerprint,
  validateRetrievalConfig,
  type RetrievalConfig,
} from './config';
import type { CaseBaseCase, CaseSourceReference } from './contracts';
import type { CaseFacts } from './model';
import {
  buildPostings,
  fitTermModel,
  type TermModel,
  type TermPostings,
} from './tfidf';

export interface IndexedCase {
  id: string;
  caseGroupId: string;
  category: string | null;
  facts: CaseFacts;
  outcomeDays: number;
  sources: readonly CaseSourceReference[];
  articles: readonly string[];
  attributeValues: ReadonlyMap<string, ExtractedAttribute>;
  documentNorm: number;
}

export interface RetrievalIndex {
  /** Cache-consistency generation of the case base snapshot. */
  generation: number;
  config: RetrievalConfig;
  configFingerprint: string;
  /** Eligible historical cases, sorted by stable case-unit ID. */
  cases: readonly IndexedCase[];
  byCaseUnitId: ReadonlyMap<string, number>;
  allCaseIndices: readonly number[];
  categories: ReadonlyMap<string, readonly number[]>;
  termModel: TermModel;
  postings: TermPostings;
  documentNorms: Float64Array;
  numericScales: NumericScales;
  termCount: number;
  eligibleCaseCount: number;
  excludedCaseCount: number;
  buildDurationMs: number;
}

export class DuplicateCaseUnitIdError extends Error {
  constructor(id: string) {
    super(`duplicate case unit ID in index input: ${id}`);
    this.name = 'DuplicateCaseUnitIdError';
  }
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export interface BuildIndexOptions {
  /** Generation copied into the index for consistency checks. */
  generation?: number;
  /** Injected clock for deterministic tests and benchmark reporting. */
  now?: () => number;
}

/**
 * Build a retrieval index from the supplied reference cases. For evaluation,
 * pass training cases only: the vocabulary, IDF, and numeric scales must not
 * see validation or test facts.
 */
export function buildRetrievalIndex(
  cases: readonly CaseBaseCase[],
  config: RetrievalConfig,
  options: BuildIndexOptions = {},
): RetrievalIndex {
  validateRetrievalConfig(config);
  const now = options.now ?? Date.now;
  const startedAt = now();

  const seenIds = new Set<string>();
  for (const candidate of cases) {
    if (seenIds.has(candidate.id)) {
      throw new DuplicateCaseUnitIdError(candidate.id);
    }
    seenIds.add(candidate.id);
  }

  const eligible = cases
    .filter(
      (candidate) =>
        isPositiveFinite(candidate.outcome.actualSentenceDays) &&
        candidate.facts.narration.trim() !== '',
    )
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));

  const termModel = fitTermModel(
    eligible.map((candidate) => candidate.facts.narration),
    config.preprocessing,
  );
  const numericScales = fitNumericScales(
    eligible.map((candidate) => candidate.facts),
    config,
  );
  const built = buildPostings(
    eligible.map((candidate) => candidate.facts.narration),
    termModel,
    config.preprocessing,
  );

  const categories = new Map<string, number[]>();
  const byCaseUnitId = new Map<string, number>();
  const indexedCases: IndexedCase[] = [];
  const attributeComponents = config.components.attributes.filter(
    (component) => component.weight > 0,
  );

  for (let index = 0; index < eligible.length; index += 1) {
    const candidate = eligible[index] as CaseBaseCase;
    const category = normalizeCategoryName(candidate.facts.category);
    const attributeValues = new Map<string, ExtractedAttribute>();
    for (const component of attributeComponents) {
      const extracted = extractAttribute(candidate.facts, component);
      if (extracted !== null) {
        attributeValues.set(component.attributeKey, extracted);
      }
    }

    indexedCases.push({
      id: candidate.id,
      caseGroupId: candidate.caseGroupId,
      category,
      facts: candidate.facts,
      outcomeDays: candidate.outcome.actualSentenceDays as number,
      sources: candidate.sources ?? [],
      articles: articleReferences(candidate.facts.articles),
      attributeValues,
      documentNorm: built.documentNorms[index] as number,
    });
    byCaseUnitId.set(candidate.id, index);

    if (category !== null) {
      const members = categories.get(category);
      if (members === undefined) {
        categories.set(category, [index]);
      } else {
        members.push(index);
      }
    }
  }

  return {
    generation: options.generation ?? 0,
    config,
    configFingerprint: retrievalConfigFingerprint(config),
    cases: indexedCases,
    byCaseUnitId,
    allCaseIndices: indexedCases.map((_, index) => index),
    categories,
    termModel,
    postings: built.postings,
    documentNorms: built.documentNorms,
    numericScales,
    termCount: built.termCount,
    eligibleCaseCount: indexedCases.length,
    excludedCaseCount: cases.length - indexedCases.length,
    buildDurationMs: now() - startedAt,
  };
}
