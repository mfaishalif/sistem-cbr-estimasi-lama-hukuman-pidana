/**
 * Retrieve and Reuse for one query.
 *
 * Retrieve ranks eligible historical cases by a weighted combination of
 * narrative cosine similarity and optional structured facts. Components that
 * are not known on both sides are excluded and the remaining weights are
 * renormalised. Reuse then takes a weighted average of actual outcomes.
 *
 * Query scoring has no access to the case base through the application context:
 * everything it may use is frozen inside the supplied index.
 */

import {
  articleReferences,
  compareArticles,
  compareAttribute,
  compareReferenceDates,
  extractAttribute,
  normalizeCategoryName,
  type ExtractedAttribute,
} from './attributes';
import type { AttributeComponentConfig, RetrievalConfig } from './config';
import type {
  CandidateSummary,
  EstimateRequest,
  EstimateResult,
  EstimateScoringSummary,
  QuerySummary,
  ReferenceComparison,
  ReferenceDetail,
  ScoreComponent,
  Withholding,
  WithholdingCode,
} from './contracts';
import type { IndexedCase, RetrievalIndex } from './retrieval-index';
import { computeWeightedReuse } from './reuse';
import { cosineScores, transformNarrative, type SparseTermVector } from './tfidf';

interface ScoredCandidate {
  indexed: IndexedCase;
  score: number;
  components: ScoreComponent[];
  comparison: ReferenceComparison;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value >= 1 ? 1 : value;
}

function queryAttributes(
  requestFacts: EstimateRequest['facts'],
  config: RetrievalConfig,
): Map<string, ExtractedAttribute> {
  const values = new Map<string, ExtractedAttribute>();
  for (const component of config.components.attributes) {
    if (component.weight === 0) {
      continue;
    }
    const extracted = extractAttribute(requestFacts, component);
    if (extracted !== null) {
      values.set(component.attributeKey, extracted);
    }
  }
  return values;
}

function attributeComponent(
  component: AttributeComponentConfig,
  similarity: number,
  detail: Record<string, unknown>,
): ScoreComponent {
  return {
    key: component.attributeKey,
    kind: 'attribute',
    weight: component.weight,
    // Recomputed once the total available weight is known.
    normalizedWeight: 0,
    similarity,
    contribution: component.weight * similarity,
    comparator: component.comparator,
    detail,
  };
}

function scoreCandidate(
  indexed: IndexedCase,
  narrativeScore: number,
  queryFacts: EstimateRequest['facts'],
  queryVector: SparseTermVector,
  queryAttributeValues: ReadonlyMap<string, ExtractedAttribute>,
  queryArticleKeys: readonly string[],
  queryMissingAttributeKeys: readonly string[],
  index: RetrievalIndex,
): ScoredCandidate {
  const config = index.config;
  const components: ScoreComponent[] = [];
  let availableWeight = config.components.narrativeWeight;
  let queryKnownWeight = 0;
  let comparableWeight = 0;

  components.push({
    key: 'narration',
    kind: 'narrative',
    weight: config.components.narrativeWeight,
    normalizedWeight: 1,
    similarity: narrativeScore,
    contribution: config.components.narrativeWeight * narrativeScore,
    detail: {
      recognizedTermCount: queryVector.recognizedTermCount,
    },
  });

  const missingCandidateAttributeKeys: string[] = [];
  const notComparableAttributeKeys: string[] = [];
  const comparedAttributeKeys: string[] = [];
  const missingCandidateArticleKeys: string[] = [];
  let articlesCompared = false;

  if (queryArticleKeys.length > 0 && config.components.articleWeight > 0) {
    const weight = config.components.articleWeight;
    queryKnownWeight += weight;
    if (indexed.articles.length === 0) {
      missingCandidateArticleKeys.push(...queryArticleKeys);
    } else {
      const compared = compareArticles(queryArticleKeys, indexed.articles);
      availableWeight += weight;
      comparableWeight += weight;
      articlesCompared = true;
      components.push({
        key: 'articles',
        kind: 'articles',
        weight,
        normalizedWeight: 0,
        similarity: clampScore(compared.similarity),
        contribution: weight * clampScore(compared.similarity),
        detail: {
          queryArticles: queryArticleKeys,
          candidateArticles: indexed.articles,
          intersection: compared.intersection,
          union: compared.union,
        },
      });
    }
  }

  for (const component of config.components.attributes) {
    if (component.weight === 0) {
      continue;
    }
    const queryValue = queryAttributeValues.get(component.attributeKey);
    if (queryValue === undefined) {
      continue;
    }

    queryKnownWeight += component.weight;
    const candidateValue = indexed.attributeValues.get(component.attributeKey);
    if (candidateValue === undefined) {
      missingCandidateAttributeKeys.push(component.attributeKey);
      continue;
    }

    const dateComparison = compareReferenceDates(
      queryFacts,
      indexed.facts,
      component,
    );
    if (!dateComparison.comparable) {
      notComparableAttributeKeys.push(component.attributeKey);
      continue;
    }

    const compared = compareAttribute(
      component,
      queryValue,
      candidateValue,
      index.numericScales,
    );
    const detail: Record<string, unknown> = { ...compared.detail };
    if (dateComparison.gapDays !== null) {
      detail.referenceDateGapDays = dateComparison.gapDays;
    }
    availableWeight += component.weight;
    comparableWeight += component.weight;
    comparedAttributeKeys.push(component.attributeKey);
    components.push(
      attributeComponent(component, clampScore(compared.similarity), detail),
    );
  }

  for (const component of components) {
    component.normalizedWeight = component.weight / availableWeight;
  }

  const totalContribution = components.reduce(
    (total, component) => total + component.contribution,
    0,
  );
  const coverage = queryKnownWeight === 0 ? 1 : comparableWeight / queryKnownWeight;

  return {
    indexed,
    score: clampScore(totalContribution / availableWeight),
    components,
    comparison: {
      queryKnownWeight,
      comparableWeight,
      coverage,
      comparedAttributeKeys,
      missingCandidateAttributeKeys,
      notComparableAttributeKeys,
      queryMissingAttributeKeys,
      missingCandidateArticleKeys,
      articlesCompared,
    },
  };
}

function makeSummary(
  index: RetrievalIndex,
  partial: Omit<CandidateSummary, 'eligibleCaseCount' | 'selectedCount'>,
): CandidateSummary {
  return {
    eligibleCaseCount: index.eligibleCaseCount,
    selectedCount: 0,
    ...partial,
  };
}

function makeScoringSummary(
  index: RetrievalIndex,
  candidates: CandidateSummary,
): EstimateScoringSummary {
  const config = index.config;
  return {
    configFingerprint: index.configFingerprint,
    narrativeWeight: config.components.narrativeWeight,
    articleWeight: config.components.articleWeight,
    configuredAttributeWeight: config.components.attributes.reduce(
      (total, component) => total + component.weight,
      0,
    ),
    maxReferences: config.retrieval.maxReferences,
    minReferences: config.retrieval.minReferences,
    minScore: config.retrieval.minScore,
    minAttributeCoverage: config.retrieval.minAttributeCoverage,
    similarityFormula: 'sum(weight x similarity) / sum(available weight)',
    reuseFormula: 'sum(score x actualSentenceDays) / sum(score)',
    candidates,
  };
}

function withheld(
  index: RetrievalIndex,
  category: string | null,
  restriction: 'same-category' | 'all-categories',
  query: QuerySummary,
  scoring: EstimateScoringSummary,
  reason: Withholding,
  references: readonly ReferenceDetail[] = [],
): EstimateResult {
  return {
    status: 'withheld',
    caseBaseGeneration: index.generation,
    configFingerprint: index.configFingerprint,
    category: { requested: category, restriction },
    query,
    estimate: {
      days: null,
      rawDays: null,
      numerator: null,
      denominator: null,
      rounding: 'nearest-day-half-up',
    },
    withholding: reason,
    references,
    scoring,
  };
}

function referenceDetails(
  candidates: readonly ScoredCandidate[],
): { references: ReferenceDetail[]; denominator: number } {
  const denominator = candidates.reduce((total, candidate) => total + candidate.score, 0);
  const references = candidates.map((candidate, position) => ({
    rank: position + 1,
    caseUnitId: candidate.indexed.id,
    caseGroupId: candidate.indexed.caseGroupId,
    score: candidate.score,
    actualSentenceDays: candidate.indexed.outcomeDays,
    components: candidate.components,
    comparison: candidate.comparison,
    reuse: {
      weight: candidate.score,
      weightShare: denominator === 0 ? 0 : candidate.score / denominator,
      weightedOutcomeDays: candidate.score * candidate.indexed.outcomeDays,
    },
    facts: candidate.indexed.facts,
    sources: candidate.indexed.sources,
  }));
  return { references, denominator };
}

function stableSortCandidates(candidates: readonly ScoredCandidate[]): ScoredCandidate[] {
  return [...candidates].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    // Stable ID tie-break. Actual outcome is never part of ranking.
    if (left.indexed.id < right.indexed.id) {
      return -1;
    }
    return left.indexed.id > right.indexed.id ? 1 : 0;
  });
}

export function estimateWithIndex(
  index: RetrievalIndex,
  request: EstimateRequest,
): EstimateResult {
  const config = index.config;
  const requestedCategory = normalizeCategoryName(request.facts.category);
  const restriction: 'same-category' | 'all-categories' =
    config.categoryRestriction === 'when-known' && requestedCategory !== null
      ? 'same-category'
      : 'all-categories';

  const queryAttributeValues = queryAttributes(request.facts, config);
  const configuredAttributeKeys = config.components.attributes
    .filter((component) => component.weight > 0)
    .map((component) => component.attributeKey);
  const queryMissingAttributeKeys = configuredAttributeKeys.filter(
    (key) => !queryAttributeValues.has(key),
  );
  const queryArticleKeys = articleReferences(request.facts.articles);

  const categoryPool =
    restriction === 'same-category'
      ? (index.categories.get(requestedCategory as string) ?? [])
      : index.allCaseIndices;
  const excludeIds = new Set(request.excludeCaseUnitIds ?? []);
  const afterExclusion = categoryPool.filter(
    (caseIndex) => !excludeIds.has((index.cases[caseIndex] as IndexedCase).id),
  );

  const query: QuerySummary = {
    tokenCount: 0,
    recognizedTermCount: 0,
    vectorNorm: 0,
    category: requestedCategory,
    categoryRestriction: restriction,
    categoryCandidateCount: categoryPool.length,
    articleCount: queryArticleKeys.length,
    knownAttributeKeys: [...queryAttributeValues.keys()],
    missingAttributeKeys: queryMissingAttributeKeys,
  };
  const emptyCandidates = makeSummary(index, {
    searchScope: restriction,
    afterCategoryCount: categoryPool.length,
    afterExclusionCount: afterExclusion.length,
    scoredCount: 0,
    rejectedBelowScore: 0,
    rejectedCoverage: 0,
  });
  const emptyScoring = makeScoringSummary(index, emptyCandidates);

  if (request.facts.narration.trim() === '') {
    return withheld(index, requestedCategory, restriction, query, emptyScoring, {
      code: 'NARASI_KOSONG',
      message: 'Narasi fakta kosong; narasi wajib untuk Retrieve.',
    });
  }

  if (index.cases.length === 0) {
    return withheld(index, requestedCategory, restriction, query, emptyScoring, {
      code: 'BASIS_KASUS_KOSONG',
      message: 'Tidak ada kasus historis layak dengan hasil aktual positif dalam basis kasus.',
    });
  }

  const queryVector = transformNarrative(
    index.termModel,
    request.facts.narration,
    config.preprocessing,
  );
  query.tokenCount = queryVector.tokenCount;
  query.recognizedTermCount = queryVector.recognizedTermCount;
  query.vectorNorm = queryVector.norm;

  if (queryVector.recognizedTermCount === 0 || queryVector.norm === 0) {
    return withheld(index, requestedCategory, restriction, query, emptyScoring, {
      code: 'NARASI_TIDAK_TERBANDING',
      message:
        'Narasi tidak memuat istilah yang dikenali dari kosakata training; atribut tidak dipakai sebagai pengganti narasi.',
      details: {
        tokenCount: queryVector.tokenCount,
        recognizedTermCount: queryVector.recognizedTermCount,
      },
    });
  }

  if (categoryPool.length === 0) {
    return withheld(index, requestedCategory, restriction, query, emptyScoring, {
      code: 'TIDAK_ADA_REFERENSI_KATEGORI',
      message:
        'Kategori input tidak memiliki kasus historis yang memenuhi syarat; pencarian tidak diperluas ke kategori lain.',
      details: {
        category: requestedCategory,
        eligibleCaseCount: index.eligibleCaseCount,
      },
    });
  }

  if (afterExclusion.length === 0) {
    return withheld(index, requestedCategory, restriction, query, emptyScoring, {
      code: 'REFERENSI_TIDAK_CUKUP',
      message: 'Semua kandidat dikecualikan (termasuk kasus yang sedang diestimasi).',
      details: { excludedCaseCount: categoryPool.length },
    });
  }

  const cosine = cosineScores(queryVector, index.documentNorms, index.postings);
  const scored: ScoredCandidate[] = [];
  let rejectedBelowScore = 0;
  let rejectedCoverage = 0;

  for (const caseIndex of afterExclusion) {
    const indexed = index.cases[caseIndex] as IndexedCase;
    const narrativeScore = clampScore(cosine.get(caseIndex) ?? 0);
    const candidate = scoreCandidate(
      indexed,
      narrativeScore,
      request.facts,
      queryVector,
      queryAttributeValues,
      queryArticleKeys,
      queryMissingAttributeKeys,
      index,
    );

    if (candidate.score <= config.retrieval.minScore || candidate.score <= 0) {
      rejectedBelowScore += 1;
      continue;
    }
    if (candidate.comparison.coverage < config.retrieval.minAttributeCoverage) {
      rejectedCoverage += 1;
      continue;
    }
    scored.push(candidate);
  }

  const ranked = stableSortCandidates(scored);
  const selected = ranked.slice(0, config.retrieval.maxReferences);
  const candidates = makeSummary(index, {
    searchScope: restriction,
    afterCategoryCount: categoryPool.length,
    afterExclusionCount: afterExclusion.length,
    scoredCount: scored.length,
    rejectedBelowScore,
    rejectedCoverage,
  });
  candidates.selectedCount = selected.length;
  const scoring = makeScoringSummary(index, candidates);
  const builtReferences = referenceDetails(selected);

  if (selected.length < config.retrieval.minReferences) {
    return withheld(
      index,
      requestedCategory,
      restriction,
      query,
      scoring,
      {
        code: 'REFERENSI_TIDAK_CUKUP',
        message: `Hanya ${selected.length} referensi layak; minimum ${config.retrieval.minReferences}. Estimasi ditahan, bukan diisi dengan kasus sembarang.`,
        details: {
          selectedCount: selected.length,
          minReferences: config.retrieval.minReferences,
          maxReferences: config.retrieval.maxReferences,
          rejectedBelowScore,
          rejectedCoverage,
        },
      },
      builtReferences.references,
    );
  }

  const reuse = computeWeightedReuse(
    selected.map((candidate) => ({
      caseUnitId: candidate.indexed.id,
      score: candidate.score,
      actualSentenceDays: candidate.indexed.outcomeDays,
    })),
  );
  if (reuse.status !== 'available') {
    return withheld(
      index,
      requestedCategory,
      restriction,
      query,
      scoring,
      {
        code: 'BOBOT_NOL',
        message: 'Jumlah bobot referensi nol; Reuse tidak dapat dihitung.',
        details: { reason: reuse.reason },
      },
      builtReferences.references,
    );
  }

  return {
    status: 'estimated',
    caseBaseGeneration: index.generation,
    configFingerprint: index.configFingerprint,
    category: { requested: requestedCategory, restriction },
    query,
    estimate: {
      days: reuse.days,
      rawDays: reuse.rawDays,
      numerator: reuse.numerator,
      denominator: reuse.denominator,
      rounding: 'nearest-day-half-up',
    },
    withholding: null,
    references: builtReferences.references,
    scoring,
  };
}

/** A minimal result for callers that could not obtain an index. */
export function withheldForUnavailableIndex(options: {
  code: Extract<WithholdingCode, 'INDEKS_BELUM_SIAP' | 'INDEKS_GAGAL_DIBANGUN'>;
  message: string;
  caseBaseGeneration: number | null;
  configFingerprint: string;
  config?: RetrievalConfig;
  details?: Record<string, unknown>;
}): EstimateResult {
  const config = options.config;
  return {
    status: 'withheld',
    caseBaseGeneration: options.caseBaseGeneration,
    configFingerprint: options.configFingerprint,
    category: { requested: null, restriction: 'all-categories' },
    query: {
      tokenCount: 0,
      recognizedTermCount: 0,
      vectorNorm: 0,
      category: null,
      categoryRestriction: 'all-categories',
      categoryCandidateCount: 0,
      articleCount: 0,
      knownAttributeKeys: [],
      missingAttributeKeys: [],
    },
    estimate: {
      days: null,
      rawDays: null,
      numerator: null,
      denominator: null,
      rounding: 'nearest-day-half-up',
    },
    withholding: {
      code: options.code,
      message: options.message,
      ...(options.details === undefined ? {} : { details: options.details }),
    },
    references: [],
    scoring: {
      configFingerprint: options.configFingerprint,
      narrativeWeight: config?.components.narrativeWeight ?? 0,
      articleWeight: config?.components.articleWeight ?? 0,
      configuredAttributeWeight:
        config?.components.attributes.reduce(
          (total, component) => total + component.weight,
          0,
        ) ?? 0,
      maxReferences: config?.retrieval.maxReferences ?? 0,
      minReferences: config?.retrieval.minReferences ?? 0,
      minScore: config?.retrieval.minScore ?? 0,
      minAttributeCoverage: config?.retrieval.minAttributeCoverage ?? 0,
      similarityFormula: 'sum(weight x similarity) / sum(available weight)',
      reuseFormula: 'sum(score x actualSentenceDays) / sum(score)',
      candidates: {
        eligibleCaseCount: 0,
        searchScope: 'all-categories',
        afterCategoryCount: 0,
        afterExclusionCount: 0,
        scoredCount: 0,
        rejectedBelowScore: 0,
        rejectedCoverage: 0,
        selectedCount: 0,
      },
    },
  };
}
