export type FactValue =
  | { type: 'text' | 'enum' | 'set'; value: string; unit?: string | null; sourceLocation?: string | null }
  | { type: 'number'; value: number; unit?: string | null; sourceLocation?: string | null }
  | { type: 'boolean'; value: boolean; sourceLocation?: string | null };

export interface CaseArticle {
  law: string;
  article: string;
  paragraph?: string | null;
  arrangement?: 'primary' | 'alternative' | 'subsidiary';
  normalizedReference?: string;
  rawText?: string | null;
  sourceLocation?: string | null;
}

export interface CaseFacts {
  narration: string;
  category?: string | null;
  categorySourceLocation?: string | null;
  articles?: CaseArticle[];
  attributes?: Record<string, FactValue>;
}

export interface CaseIdentity {
  court: string;
  caseNumber: string;
  defendantName?: string | null;
}

export interface CaseUnit {
  id: string;
  caseGroupId: string;
  identity: CaseIdentity;
  facts: CaseFacts;
  outcome: { actualSentenceDays: number | null };
  createdAt: string;
  updatedAt: string;
  sources: CaseSource[];
}

export interface CaseSource {
  sourceDocumentId: string;
  contentHash: string;
  snapshotPath: string;
  sourceUrl: string | null;
  narrationLocation: string | null;
  outcomeLocation: string | null;
  aliases: string[];
}

export interface CaseUnitSummary {
  id: string;
  caseGroupId: string;
  caseGroupLabel: string | null;
  court: string;
  caseNumber: string;
  defendantName: string | null;
  category: string | null;
  narrationPreview: string | null;
  actualSentenceDays: number | null;
  articleCount: number;
  sourceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CaseListResponse {
  items: CaseUnitSummary[];
  total: number;
  limit: number;
  offset: number;
  generation: number;
}

export interface VocabularyCount {
  value: string;
  caseCount: number;
}

export interface VocabularyResponse {
  generation: number;
  categories: VocabularyCount[];
  uncategorizedCount: number;
  attributes: {
    education: VocabularyCount[];
    occupation: VocabularyCount[];
  };
  limit: number;
}

export interface CaseDraft {
  court: string;
  caseNumber: string;
  defendantName?: string | null;
  narration: string;
  category?: string | null;
  actualSentenceDays?: number | null;
  articles?: CaseArticle[];
  attributes?: Record<string, FactValue>;
}

export interface ScoreComponent {
  key: string;
  kind: 'narrative' | 'articles' | 'attribute';
  weight: number;
  normalizedWeight: number;
  similarity: number;
  contribution: number;
  comparator?: string;
  detail?: Record<string, unknown>;
}

export interface ReferenceComparison {
  queryKnownWeight: number;
  comparableWeight: number;
  coverage: number;
  comparedAttributeKeys: string[];
  missingCandidateAttributeKeys: string[];
  notComparableAttributeKeys: string[];
  queryMissingAttributeKeys: string[];
  missingCandidateArticleKeys: string[];
  articlesCompared: boolean;
}

export interface ReferenceDetail {
  rank: number;
  caseUnitId: string;
  caseGroupId: string;
  identity: CaseIdentity;
  score: number;
  actualSentenceDays: number;
  components: ScoreComponent[];
  comparison: ReferenceComparison;
  reuse: { weight: number; weightShare: number; weightedOutcomeDays: number };
  facts: CaseFacts;
  sources: CaseSource[];
}

export interface Withholding {
  code:
    | 'NARASI_KOSONG'
    | 'NARASI_TIDAK_TERBANDING'
    | 'BASIS_KASUS_KOSONG'
    | 'TIDAK_ADA_REFERENSI_KATEGORI'
    | 'REFERENSI_TIDAK_CUKUP'
    | 'BOBOT_NOL'
    | 'INDEKS_BELUM_SIAP'
    | 'INDEKS_GAGAL_DIBANGUN';
  message: string;
  details?: Record<string, unknown>;
}

export interface EstimateResult {
  status: 'estimated' | 'withheld';
  caseBaseGeneration: number | null;
  configFingerprint: string;
  category: { requested: string | null; restriction: 'same-category' | 'all-categories' };
  query: {
    tokenCount: number;
    recognizedTermCount: number;
    vectorNorm: number;
    category: string | null;
    categoryRestriction: 'same-category' | 'all-categories';
    categoryCandidateCount: number;
    articleCount: number;
    knownAttributeKeys: string[];
    missingAttributeKeys: string[];
  };
  estimate: {
    days: number | null;
    rawDays: number | null;
    numerator: number | null;
    denominator: number | null;
    rounding: 'nearest-day-half-up';
  };
  withholding: Withholding | null;
  references: ReferenceDetail[];
  scoring: {
    configFingerprint: string;
    narrativeWeight: number;
    articleWeight: number;
    configuredAttributeWeight: number;
    maxReferences: number;
    minReferences: number;
    minScore: number;
    minAttributeCoverage: number;
    similarityFormula: string;
    reuseFormula: string;
    candidates: {
      eligibleCaseCount: number;
      searchScope: 'same-category' | 'all-categories';
      afterCategoryCount: number;
      afterExclusionCount: number;
      scoredCount: number;
      rejectedBelowScore: number;
      rejectedCoverage: number;
      selectedCount: number;
    };
  };
}

export type IndexStatus =
  | {
      status: 'ready';
      generation: number;
      configFingerprint: string;
      caseCount: number;
      eligibleCaseCount: number;
      termCount: number;
      buildDurationMs: number;
      builtAt: string;
    }
  | {
      status: 'stale';
      reason: 'NOT_BUILT' | 'GENERATION_CHANGED' | 'CONFIG_CHANGED';
      currentGeneration: number | null;
      indexGeneration: number | null;
    }
  | { status: 'building'; targetGeneration: number | null; startedAt: string }
  | { status: 'failed'; message: string; generation: number | null; failedAt: string };

export interface IndexStatusResponse {
  index: IndexStatus;
  configFingerprint: string;
  configSource: string;
}

export interface RetrievalConfig {
  version: 1;
  preprocessing: {
    minTokenLength: number;
    stopwords: string[];
    sublinearTermFrequency: boolean;
    smoothInverseDocumentFrequency: boolean;
  };
  components: {
    narrativeWeight: number;
    articleWeight: number;
    attributeGroupWeight?: number;
    attributes: Array<{
      attributeKey: string;
      weight: number;
      comparator: string;
      requireReferenceDate?: boolean;
      maxReferenceDateGapDays?: number;
    }>;
  };
  categoryRestriction: 'when-known' | 'never';
  retrieval: {
    maxReferences: number;
    minReferences: number;
    minScore: number;
    minAttributeCoverage: number;
  };
  rounding: 'nearest-day-half-up';
}

export interface ConfigResponse {
  config: RetrievalConfig;
  fingerprint: string;
  sourcePath: string | null;
  displayPath: string;
  persistedUpdatedAt: string | null;
  persisted: boolean;
}

export interface HealthResponse {
  status: string;
  service: string;
  time: string;
  database: {
    ok: boolean;
    schemaVersion: string | null;
    caseUnits: number;
    caseGroups: number;
    generation: number;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `API membalas ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) {
        message = body.message.join(', ');
      } else if (typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      // Keep the status-based message when the body is not JSON.
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export const api = {
  health: () => request<HealthResponse>('/api/health'),

  indexStatus: () => request<IndexStatusResponse>('/api/index/status'),

  config: () => request<ConfigResponse>('/api/config'),

  estimate: (facts: CaseFacts, excludeCaseUnitIds: string[] = []) =>
    request<EstimateResult>('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({ facts, excludeCaseUnitIds }),
    }),

  vocabulary: () => request<VocabularyResponse>('/api/vocabulary'),

  listCases: (options: { limit?: number; offset?: number; q?: string; category?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.offset !== undefined) params.set('offset', String(options.offset));
    if (options.q?.trim()) params.set('q', options.q.trim());
    if (options.category?.trim()) params.set('category', options.category.trim());
    const query = params.toString();
    const suffix = query === '' ? '' : `?${query}`;
    return request<CaseListResponse>(`/api/cases${suffix}`);
  },

  getCase: (id: string) => request<CaseUnit>(`/api/cases/${encodeURIComponent(id)}`),

  createCase: (draft: CaseDraft) =>
    request<CaseUnit>('/api/cases', {
      method: 'POST',
      body: JSON.stringify(draft),
    }),

  updateCase: (id: string, draft: CaseDraft) =>
    request<CaseUnit>(`/api/cases/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(draft),
    }),

  reviseOutcome: (id: string, actualSentenceDays: number | null) =>
    request<CaseUnit>(`/api/cases/${encodeURIComponent(id)}/outcome`, {
      method: 'PATCH',
      body: JSON.stringify({ actualSentenceDays }),
    }),

  deleteCase: (id: string) =>
    request<{ deleted: boolean; caseUnitId: string; generation: number }>(
      `/api/cases/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
