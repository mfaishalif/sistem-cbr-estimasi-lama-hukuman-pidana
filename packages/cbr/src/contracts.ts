/**
 * Shared Retrieve–Reuse output contract.
 *
 * The API and the evaluation CLI both consume this shape. It contains no HTTP
 * or UI concepts and always explains an estimate or why it was withheld.
 */

import type { CaseFacts, CaseOutcome, CaseUnit } from './model';
import type { RetrievalConfig } from './config';

export interface CaseSourceReference {
  sourceDocumentId: string;
  snapshotPath: string;
  contentHash?: string | null;
  sourceUrl?: string | null;
  narrationLocation?: string | null;
  outcomeLocation?: string | null;
  /** Every path/ID/URL alias known for the canonical source document */
  aliases?: readonly string[];
}

/**
 * The part of a case unit the engine needs. A full `CaseUnit` is structurally
 * compatible; `sources` is optional so synthetic evaluation cases can omit it.
 */
export interface CaseBaseCase {
  id: string;
  caseGroupId: string;
  identity: CaseUnit['identity'];
  facts: CaseFacts;
  outcome: CaseOutcome;
  sources?: readonly CaseSourceReference[];
}

export interface EstimateRequest {
  /** Pre-verdict facts of the new case. */
  facts: CaseFacts;
  /** Never retrieve the query case itself when it is already in the case base. */
  excludeCaseUnitIds?: readonly string[];
}

export type WithholdingCode =
  | 'NARASI_KOSONG'
  | 'NARASI_TIDAK_TERBANDING'
  | 'BASIS_KASUS_KOSONG'
  | 'TIDAK_ADA_REFERENSI_KATEGORI'
  | 'REFERENSI_TIDAK_CUKUP'
  | 'BOBOT_NOL'
  | 'INDEKS_BELUM_SIAP'
  | 'INDEKS_GAGAL_DIBANGUN';

export interface Withholding {
  code: WithholdingCode;
  message: string;
  details?: Record<string, unknown>;
}

export type ScoreComponentKind = 'narrative' | 'articles' | 'attribute';

export interface ScoreComponent {
  key: string;
  kind: ScoreComponentKind;
  weight: number;
  /** Share of the pair's available weight: weight / availableWeight. */
  normalizedWeight: number;
  similarity: number;
  /** weight × similarity. */
  contribution: number;
  comparator?: string;
  detail?: Record<string, unknown>;
}

export interface ReferenceComparison {
  /** Weight of optional components known on the query side. */
  queryKnownWeight: number;
  /** Optional weight actually compared on both sides. */
  comparableWeight: number;
  /** comparableWeight / queryKnownWeight, or 1 when the query has no optional facts. */
  coverage: number;
  comparedAttributeKeys: readonly string[];
  /** Query-known attributes the candidate cannot supply. */
  missingCandidateAttributeKeys: readonly string[];
  /** Query-known attributes the candidate has but cannot be compared safely. */
  notComparableAttributeKeys: readonly string[];
  /** Attributes the query does not know; not counted against the candidate. */
  queryMissingAttributeKeys: readonly string[];
  /** Query articles that a candidate without articles cannot compare. */
  missingCandidateArticleKeys: readonly string[];
  articlesCompared: boolean;
}

export interface ReferenceDetail {
  /** 1-based deterministic rank. */
  rank: number;
  caseUnitId: string;
  caseGroupId: string;
  /** Court and complete case number of the reference, for traceability. */
  identity: CaseUnit['identity'];
  score: number;
  actualSentenceDays: number;
  /** weight × similarity for every component available on both sides. */
  components: readonly ScoreComponent[];
  comparison: ReferenceComparison;
  /** Reuse inputs for this reference. */
  reuse: {
    weight: number;
    weightShare: number;
    weightedOutcomeDays: number;
  };
  facts: CaseFacts;
  sources: readonly CaseSourceReference[];
}

export interface CandidateSummary {
  eligibleCaseCount: number;
  searchScope: 'same-category' | 'all-categories';
  afterCategoryCount: number;
  afterExclusionCount: number;
  scoredCount: number;
  rejectedBelowScore: number;
  rejectedCoverage: number;
  selectedCount: number;
}

export interface QuerySummary {
  tokenCount: number;
  recognizedTermCount: number;
  vectorNorm: number;
  category: string | null;
  categoryRestriction: 'same-category' | 'all-categories';
  categoryCandidateCount: number;
  articleCount: number;
  knownAttributeKeys: readonly string[];
  missingAttributeKeys: readonly string[];
}

export interface EstimateScoringSummary {
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
  candidates: CandidateSummary;
}

export interface EstimateResult {
  status: 'estimated' | 'withheld';
  caseBaseGeneration: number | null;
  configFingerprint: string;
  category: {
    requested: string | null;
    restriction: 'same-category' | 'all-categories';
  };
  query: QuerySummary;
  estimate: {
    days: number | null;
    rawDays: number | null;
    numerator: number | null;
    denominator: number | null;
    rounding: 'nearest-day-half-up';
  };
  withholding: Withholding | null;
  references: readonly ReferenceDetail[];
  scoring: EstimateScoringSummary;
}

export interface CaseBaseSnapshot {
  /** Cache-consistency generation, not case version history. */
  generation: number;
  cases: readonly CaseBaseCase[];
}

/**
 * The engine's data boundary. `packages/data` supplies a SQLite adapter; tests
 * use an in-memory source.
 */
export interface CaseBaseSnapshotSource {
  getGeneration(): number;
  loadSnapshot(): CaseBaseSnapshot;
  /**
   * Optional persisted configuration. When present and the manager was not
   * given an explicit config, it is refreshed at the start of every rebuild so
   * a stored configuration change cannot be paired with an old index.
   */
  loadConfig?(): RetrievalConfig;
}

export class CaseBaseChangedDuringReadError extends Error {
  constructor() {
    super('the case base changed while a snapshot was being read');
    this.name = 'CaseBaseChangedDuringReadError';
  }
}
