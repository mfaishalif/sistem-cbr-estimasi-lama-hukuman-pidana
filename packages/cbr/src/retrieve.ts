/**
 * Retrieve dan Reuse untuk satu kueri.
 *
 * Retrieve memberi skor pada setiap kasus historis yang layak:
 *
 *   skor = Σ(bobot × kemiripan) ÷ Σ(bobot komponen yang dapat dibandingkan)
 *
 * Kronologi (narasi) selalu dibandingkan. Pasal dakwaan dan atribut hanya
 * dihitung bila diketahui di kedua sisi; bila tidak, komponen itu keluar dari
 * pembilang dan penyebut, sehingga fakta yang kosong tidak menaikkan maupun
 * menurunkan skor. Reuse lalu menghitung rata-rata hukuman aktual kasus
 * terpilih, ditimbang dengan skornya.
 *
 * Penilaian kueri tidak mengakses basis kasus lewat konteks aplikasi: semua
 * yang boleh dipakai sudah dibekukan di dalam indeks yang diberikan.
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

type CategoryRestriction = 'same-category' | 'all-categories';
type QueryFacts = EstimateRequest['facts'];

const SIMILARITY_FORMULA = 'sum(weight x similarity) / sum(available weight)';
const REUSE_FORMULA = 'sum(score x actualSentenceDays) / sum(score)';

/** Fakta sisi kueri, dihitung sekali lalu dipakai untuk semua kandidat. */
interface StructuredQuery {
  facts: QueryFacts;
  articleKeys: readonly string[];
  /** Atribut berbobot lebih dari nol, sesuai urutan di konfigurasi. */
  attributes: readonly AttributeComponentConfig[];
  attributeValues: ReadonlyMap<string, ExtractedAttribute>;
  missingAttributeKeys: readonly string[];
  attributeWeight: (component: AttributeComponentConfig) => number;
  /** Total bobot komponen opsional yang diisi kueri; penyebut cakupan (coverage). */
  knownWeight: number;
}

interface PreparedQuery extends StructuredQuery {
  vector: SparseTermVector;
}

interface ScoredCandidate {
  indexed: IndexedCase;
  score: number;
  components: ScoreComponent[];
  comparison: ReferenceComparison;
}

/** Data yang sama untuk semua hasil dari satu permintaan. */
interface ResultContext {
  index: RetrievalIndex;
  category: string | null;
  restriction: CategoryRestriction;
  query: QuerySummary;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value >= 1 ? 1 : value;
}

// ---------------------------------------------------------------------------
// Persiapan kueri
// ---------------------------------------------------------------------------

function prepareStructuredQuery(facts: QueryFacts, config: RetrievalConfig): StructuredQuery {
  const { articleWeight, attributeGroupWeight } = config.components;
  const articleKeys = articleReferences(facts.articles);
  const attributes = config.components.attributes.filter((component) => component.weight > 0);

  const attributeValues = new Map<string, ExtractedAttribute>();
  for (const component of attributes) {
    const extracted = extractAttribute(facts, component);
    if (extracted !== null) {
      attributeValues.set(component.attributeKey, extracted);
    }
  }
  const missingAttributeKeys = attributes
    .map((component) => component.attributeKey)
    .filter((key) => !attributeValues.has(key));
  const knownAttributes = attributes.filter((component) =>
    attributeValues.has(component.attributeKey),
  );

  // Bila ada bobot kelompok, atribut yang diisi kueri membagi rata bobot itu
  // (bobot ÷ n). Bila tidak, tiap atribut memakai bobotnya sendiri.
  const knownAttributeCount = knownAttributes.length;
  const attributeWeight = (component: AttributeComponentConfig): number => {
    if (attributeGroupWeight === undefined) {
      return component.weight;
    }
    return knownAttributeCount === 0 ? 0 : attributeGroupWeight / knownAttributeCount;
  };

  let knownWeight = 0;
  if (articleKeys.length > 0 && articleWeight > 0) {
    knownWeight += articleWeight;
  }
  if (attributeGroupWeight !== undefined) {
    if (knownAttributeCount > 0) {
      knownWeight += attributeGroupWeight;
    }
  } else {
    for (const component of knownAttributes) {
      knownWeight += component.weight;
    }
  }

  return {
    facts,
    articleKeys,
    attributes,
    attributeValues,
    missingAttributeKeys,
    attributeWeight,
    knownWeight,
  };
}

// ---------------------------------------------------------------------------
// Retrieve: menilai satu kandidat
// ---------------------------------------------------------------------------

function scoreComponent(
  fields: Omit<ScoreComponent, 'normalizedWeight' | 'contribution'>,
): ScoreComponent {
  const { key, kind, weight, similarity, ...rest } = fields;
  return {
    key,
    kind,
    weight,
    // Diisi setelah total bobot yang tersedia untuk kandidat ini diketahui.
    normalizedWeight: 0,
    similarity,
    contribution: weight * similarity,
    ...rest,
  };
}

function scoreCandidate(
  indexed: IndexedCase,
  narrativeScore: number,
  query: PreparedQuery,
  index: RetrievalIndex,
): ScoredCandidate {
  const weights = index.config.components;
  const components: ScoreComponent[] = [];
  const comparedAttributeKeys: string[] = [];
  const missingCandidateAttributeKeys: string[] = [];
  const notComparableAttributeKeys: string[] = [];
  const missingCandidateArticleKeys: string[] = [];
  let articlesCompared = false;

  // Penyebut skor. Kronologi selalu dapat dibandingkan.
  let availableWeight = weights.narrativeWeight;
  // Bobot opsional yang benar-benar dibandingkan; pembilang cakupan.
  let comparableWeight = 0;

  components.push(
    scoreComponent({
      key: 'narration',
      kind: 'narrative',
      weight: weights.narrativeWeight,
      similarity: narrativeScore,
      detail: { recognizedTermCount: query.vector.recognizedTermCount },
    }),
  );

  if (query.articleKeys.length > 0 && weights.articleWeight > 0) {
    if (indexed.articles.length === 0) {
      missingCandidateArticleKeys.push(...query.articleKeys);
    } else {
      const compared = compareArticles(query.articleKeys, indexed.articles);
      availableWeight += weights.articleWeight;
      comparableWeight += weights.articleWeight;
      articlesCompared = true;
      components.push(
        scoreComponent({
          key: 'articles',
          kind: 'articles',
          weight: weights.articleWeight,
          similarity: clampScore(compared.similarity),
          detail: {
            queryArticles: query.articleKeys,
            candidateArticles: indexed.articles,
            intersection: compared.intersection,
            union: compared.union,
          },
        }),
      );
    }
  }

  for (const component of query.attributes) {
    const key = component.attributeKey;
    const queryValue = query.attributeValues.get(key);
    if (queryValue === undefined) {
      continue;
    }
    const candidateValue = indexed.attributeValues.get(key);
    if (candidateValue === undefined) {
      missingCandidateAttributeKeys.push(key);
      continue;
    }

    // Beberapa atribut (misalnya umur) hanya bermakna bila tanggal
    // penangkapan kedua perkara berdekatan; di luar batas itu atribut dilewati.
    const dates = compareReferenceDates(query.facts, indexed.facts, component);
    if (!dates.comparable) {
      notComparableAttributeKeys.push(key);
      continue;
    }

    const compared = compareAttribute(component, queryValue, candidateValue, index.numericScales);
    const detail: Record<string, unknown> = { ...compared.detail };
    if (dates.gapDays !== null) {
      detail.referenceDateGapDays = dates.gapDays;
    }

    const weight = query.attributeWeight(component);
    availableWeight += weight;
    comparableWeight += weight;
    comparedAttributeKeys.push(key);
    components.push(
      scoreComponent({
        key,
        kind: 'attribute',
        weight,
        similarity: clampScore(compared.similarity),
        comparator: component.comparator,
        detail,
      }),
    );
  }

  for (const component of components) {
    component.normalizedWeight = component.weight / availableWeight;
  }
  const totalContribution = components.reduce(
    (total, component) => total + component.contribution,
    0,
  );

  return {
    indexed,
    score: clampScore(totalContribution / availableWeight),
    components,
    comparison: {
      queryKnownWeight: query.knownWeight,
      comparableWeight,
      // Porsi fakta opsional kueri yang dapat dibandingkan dengan kandidat ini.
      coverage: query.knownWeight === 0 ? 1 : comparableWeight / query.knownWeight,
      comparedAttributeKeys,
      missingCandidateAttributeKeys,
      notComparableAttributeKeys,
      queryMissingAttributeKeys: query.missingAttributeKeys,
      missingCandidateArticleKeys,
      articlesCompared,
    },
  };
}

function rankCandidates(candidates: readonly ScoredCandidate[]): ScoredCandidate[] {
  return [...candidates].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    // Skor sama diurutkan menurut ID. Hukuman aktual tidak pernah ikut menentukan peringkat.
    if (left.indexed.id < right.indexed.id) {
      return -1;
    }
    return left.indexed.id > right.indexed.id ? 1 : 0;
  });
}

// ---------------------------------------------------------------------------
// Penyusunan hasil
// ---------------------------------------------------------------------------

function configuredAttributeWeight(config: RetrievalConfig): number {
  return (
    config.components.attributeGroupWeight ??
    config.components.attributes.reduce((total, component) => total + component.weight, 0)
  );
}

function emptyEstimate(): EstimateResult['estimate'] {
  return {
    days: null,
    rawDays: null,
    numerator: null,
    denominator: null,
    rounding: 'nearest-day-half-up',
  };
}

function candidateSummary(
  index: RetrievalIndex,
  counts: Omit<CandidateSummary, 'eligibleCaseCount'>,
): CandidateSummary {
  return { eligibleCaseCount: index.eligibleCaseCount, ...counts };
}

function scoringSummary(
  index: RetrievalIndex,
  candidates: CandidateSummary,
): EstimateScoringSummary {
  const config = index.config;
  return {
    configFingerprint: index.configFingerprint,
    narrativeWeight: config.components.narrativeWeight,
    articleWeight: config.components.articleWeight,
    configuredAttributeWeight: configuredAttributeWeight(config),
    maxReferences: config.retrieval.maxReferences,
    minReferences: config.retrieval.minReferences,
    minScore: config.retrieval.minScore,
    minAttributeCoverage: config.retrieval.minAttributeCoverage,
    similarityFormula: SIMILARITY_FORMULA,
    reuseFormula: REUSE_FORMULA,
    candidates,
  };
}

function referenceDetails(candidates: readonly ScoredCandidate[]): ReferenceDetail[] {
  const totalScore = candidates.reduce((total, candidate) => total + candidate.score, 0);
  return candidates.map((candidate, position) => ({
    rank: position + 1,
    caseUnitId: candidate.indexed.id,
    caseGroupId: candidate.indexed.caseGroupId,
    identity: candidate.indexed.identity,
    score: candidate.score,
    actualSentenceDays: candidate.indexed.outcomeDays,
    components: candidate.components,
    comparison: candidate.comparison,
    reuse: {
      weight: candidate.score,
      weightShare: totalScore === 0 ? 0 : candidate.score / totalScore,
      weightedOutcomeDays: candidate.score * candidate.indexed.outcomeDays,
    },
    facts: candidate.indexed.facts,
    sources: candidate.indexed.sources,
  }));
}

function withheld(
  context: ResultContext,
  scoring: EstimateScoringSummary,
  reason: Withholding,
  references: readonly ReferenceDetail[] = [],
): EstimateResult {
  return {
    status: 'withheld',
    caseBaseGeneration: context.index.generation,
    configFingerprint: context.index.configFingerprint,
    category: { requested: context.category, restriction: context.restriction },
    query: context.query,
    estimate: emptyEstimate(),
    withholding: reason,
    references,
    scoring,
  };
}

// ---------------------------------------------------------------------------
// Fungsi utama
// ---------------------------------------------------------------------------

export function estimateWithIndex(index: RetrievalIndex, request: EstimateRequest): EstimateResult {
  const config = index.config;
  const { maxReferences, minReferences, minScore, minAttributeCoverage } = config.retrieval;

  // Kategori yang diketahui membatasi pencarian ke kategori itu; tidak pernah diperluas.
  const category = normalizeCategoryName(request.facts.category);
  const restriction: CategoryRestriction =
    config.categoryRestriction === 'when-known' && category !== null
      ? 'same-category'
      : 'all-categories';
  const categoryPool =
    restriction === 'same-category'
      ? (index.categories.get(category as string) ?? [])
      : index.allCaseIndices;

  // ID yang dikecualikan mencegah perkara dibandingkan dengan dirinya sendiri.
  const excludedIds = new Set(request.excludeCaseUnitIds ?? []);
  const candidatePool = categoryPool.filter(
    (caseIndex) => !excludedIds.has((index.cases[caseIndex] as IndexedCase).id),
  );

  const structured = prepareStructuredQuery(request.facts, config);
  const querySummary: QuerySummary = {
    tokenCount: 0,
    recognizedTermCount: 0,
    vectorNorm: 0,
    category,
    categoryRestriction: restriction,
    categoryCandidateCount: categoryPool.length,
    articleCount: structured.articleKeys.length,
    knownAttributeKeys: [...structured.attributeValues.keys()],
    missingAttributeKeys: structured.missingAttributeKeys,
  };
  const context: ResultContext = { index, category, restriction, query: querySummary };
  const poolCounts = {
    searchScope: restriction,
    afterCategoryCount: categoryPool.length,
    afterExclusionCount: candidatePool.length,
  };
  const emptyScoring = scoringSummary(
    index,
    candidateSummary(index, {
      ...poolCounts,
      scoredCount: 0,
      rejectedBelowScore: 0,
      rejectedCoverage: 0,
      selectedCount: 0,
    }),
  );

  if (request.facts.narration.trim() === '') {
    return withheld(context, emptyScoring, {
      code: 'NARASI_KOSONG',
      message: 'Narasi fakta kosong; narasi wajib untuk Retrieve.',
    });
  }

  if (index.cases.length === 0) {
    return withheld(context, emptyScoring, {
      code: 'BASIS_KASUS_KOSONG',
      message: 'Tidak ada kasus historis layak dengan hasil aktual positif dalam basis kasus.',
    });
  }

  const vector = transformNarrative(index.termModel, request.facts.narration, config.preprocessing);
  // Objek ringkasan ini dipakai bersama `context`, jadi hasil berikutnya ikut memuat angka ini.
  querySummary.tokenCount = vector.tokenCount;
  querySummary.recognizedTermCount = vector.recognizedTermCount;
  querySummary.vectorNorm = vector.norm;

  // Tanpa kronologi yang dapat dibandingkan, estimasi tidak dibuat; atribut
  // saja tidak dipakai sebagai pengganti.
  if (vector.recognizedTermCount === 0 || vector.norm === 0) {
    return withheld(context, emptyScoring, {
      code: 'NARASI_TIDAK_TERBANDING',
      message:
        'Narasi tidak memuat istilah yang dikenali dari kosakata training; atribut tidak dipakai sebagai pengganti narasi.',
      details: {
        tokenCount: vector.tokenCount,
        recognizedTermCount: vector.recognizedTermCount,
      },
    });
  }

  if (categoryPool.length === 0) {
    return withheld(context, emptyScoring, {
      code: 'TIDAK_ADA_REFERENSI_KATEGORI',
      message:
        'Kategori input tidak memiliki kasus historis yang memenuhi syarat; pencarian tidak diperluas ke kategori lain.',
      details: { category, eligibleCaseCount: index.eligibleCaseCount },
    });
  }

  if (candidatePool.length === 0) {
    return withheld(context, emptyScoring, {
      code: 'REFERENSI_TIDAK_CUKUP',
      message: 'Semua kandidat dikecualikan (termasuk kasus yang sedang diestimasi).',
      details: { excludedCaseCount: categoryPool.length },
    });
  }

  // Retrieve: nilai semua kandidat, lalu buang yang skornya rendah atau cakupannya kurang.
  const query: PreparedQuery = { ...structured, vector };
  const cosine = cosineScores(vector, index.documentNorms, index.postings);
  const accepted: ScoredCandidate[] = [];
  let rejectedBelowScore = 0;
  let rejectedCoverage = 0;

  for (const caseIndex of candidatePool) {
    const indexed = index.cases[caseIndex] as IndexedCase;
    const narrativeScore = clampScore(cosine.get(caseIndex) ?? 0);
    const candidate = scoreCandidate(indexed, narrativeScore, query, index);

    if (candidate.score <= minScore || candidate.score <= 0) {
      rejectedBelowScore += 1;
    } else if (candidate.comparison.coverage < minAttributeCoverage) {
      rejectedCoverage += 1;
    } else {
      accepted.push(candidate);
    }
  }

  const selected = rankCandidates(accepted).slice(0, maxReferences);
  const scoring = scoringSummary(
    index,
    candidateSummary(index, {
      ...poolCounts,
      scoredCount: accepted.length,
      rejectedBelowScore,
      rejectedCoverage,
      selectedCount: selected.length,
    }),
  );
  const references = referenceDetails(selected);

  // Referensi terlalu sedikit: estimasi ditahan, bukan diisi dengan kasus yang tidak mirip.
  if (selected.length < minReferences) {
    return withheld(
      context,
      scoring,
      {
        code: 'REFERENSI_TIDAK_CUKUP',
        message: `Hanya ${selected.length} referensi layak; minimum ${minReferences}. Estimasi ditahan, bukan diisi dengan kasus sembarang.`,
        details: {
          selectedCount: selected.length,
          minReferences,
          maxReferences,
          rejectedBelowScore,
          rejectedCoverage,
        },
      },
      references,
    );
  }

  // Reuse: rata-rata hukuman aktual kasus terpilih, ditimbang dengan skornya.
  const reuse = computeWeightedReuse(
    selected.map((candidate) => ({
      caseUnitId: candidate.indexed.id,
      score: candidate.score,
      actualSentenceDays: candidate.indexed.outcomeDays,
    })),
  );
  if (reuse.status !== 'available') {
    return withheld(
      context,
      scoring,
      {
        code: 'BOBOT_NOL',
        message: 'Jumlah bobot referensi nol; Reuse tidak dapat dihitung.',
        details: { reason: reuse.reason },
      },
      references,
    );
  }

  return {
    status: 'estimated',
    caseBaseGeneration: index.generation,
    configFingerprint: index.configFingerprint,
    category: { requested: category, restriction },
    query: querySummary,
    estimate: {
      days: reuse.days,
      rawDays: reuse.rawDays,
      numerator: reuse.numerator,
      denominator: reuse.denominator,
      rounding: 'nearest-day-half-up',
    },
    withholding: null,
    references,
    scoring,
  };
}

/** Hasil minimal untuk pemanggil yang belum mendapatkan indeks. */
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
    estimate: emptyEstimate(),
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
      configuredAttributeWeight: config === undefined ? 0 : configuredAttributeWeight(config),
      maxReferences: config?.retrieval.maxReferences ?? 0,
      minReferences: config?.retrieval.minReferences ?? 0,
      minScore: config?.retrieval.minScore ?? 0,
      minAttributeCoverage: config?.retrieval.minAttributeCoverage ?? 0,
      similarityFormula: SIMILARITY_FORMULA,
      reuseFormula: REUSE_FORMULA,
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
