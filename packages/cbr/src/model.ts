/**
 * Domain model for the case base.
 *
 * These types are shared by the API, the import tooling, and the CBR engine.
 * They deliberately contain no HTTP, browser, filesystem, or SQLite concepts.
 *
 * A missing optional value means "not known". It never means zero, "none",
 * or "no". Values that are explicitly absent are stored explicitly, for
 * example `prior_conviction: 'no'` versus no `prior_conviction` entry at all.
 */

export type ArticleArrangement = 'primary' | 'alternative' | 'subsidiary';

/** An article of the indictment (pasal dakwaan), not a proven offence. */
export interface CaseArticle {
  law: string;
  article: string;
  paragraph?: string | null;
  arrangement?: ArticleArrangement;
  /** Normalized reference used by structured similarity; never derived from the verdict. */
  normalizedReference: string;
  rawText?: string | null;
  /** Location in the source document supporting this article. */
  sourceLocation?: string | null;
}

export type FactValue =
  | {
      type: 'text' | 'enum' | 'set';
      value: string;
      unit?: string | null;
      sourceLocation?: string | null;
    }
  | { type: 'number'; value: number; unit?: string | null; sourceLocation?: string | null }
  | { type: 'boolean'; value: boolean; sourceLocation?: string | null };

/** `set` values are stored as a JSON array of strings in the text column. */
export type CaseArticleDraft = Omit<CaseArticle, 'normalizedReference' | 'arrangement'> & {
  arrangement?: ArticleArrangement;
  normalizedReference?: string;
};

/** Case identity parts are normalized for matching, never for display. */
export interface NormalizedCaseIdentity {
  court: string;
  caseNumber: string;
}

/**
 * Known fact attribute keys. The list is a starting vocabulary, not a claim
 * that every attribute is available or useful for every case.
 *
 * `age_years` is only comparable when an `age_reference_date` is known.
 * `prior_conviction` accepts 'yes' or 'no'; absence means unknown.
 */
export const FACT_ATTRIBUTE_KEYS = [
  'age_years',
  'age_reference_date',
  'gender',
  'occupation',
  'education',
  'role',
  'victim_count',
  'victim_harm',
  'loss_amount_idr',
  'weapon_or_mode',
  'prior_conviction',
] as const;

export type FactAttributeKey = (typeof FACT_ATTRIBUTE_KEYS)[number];

/** The facts of one defendant in one case, known before the verdict. */
export interface CaseFacts {
  /** Required; a case without comparable narration cannot be retrieved. */
  narration: string;
  /** Normalized category of conduct, only when it is safe to determine. */
  category?: string | null;
  /** Location in the source document supporting the category. */
  categorySourceLocation?: string | null;
  /** Optional indictment articles, including alternative/subsidiary arrangements. */
  articles?: CaseArticleDraft[];
  /** Optional structured attributes; absent means unknown. */
  attributes?: Record<string, FactValue>;
}

/** The actual sentence, distinct from any estimate. `null` means not known. */
export interface CaseOutcome {
  /**
   * Days of imprisonment in the verdict. `0` is a known non-custodial outcome;
   * `null` means the outcome is unknown. Retrieval excludes non-positive
   * outcomes but must not confuse them with unknown values.
   */
  actualSentenceDays: number | null;
}

export interface CaseIdentity {
  court: string;
  /** Normalized complete case number including year and case type. */
  caseNumber: string;
  /** Stored for traceability only; never a matching key or similarity feature. */
  defendantName?: string | null;
}

export interface CaseUnit {
  /** Stable internal ID, separate from any source document identity. */
  id: string;
  caseGroupId: string;
  identity: CaseIdentity;
  facts: CaseFacts;
  outcome: CaseOutcome;
  createdAt: string;
  updatedAt: string;
}

/** Input for creating one case unit. The ID and casing identity are assigned by the data layer. */
export interface CaseUnitDraft {
  court: string;
  caseNumber: string;
  defendantName?: string | null;
  narration: string;
  category?: string | null;
  categorySourceLocation?: string | null;
  actualSentenceDays?: number | null;
  /** Use an existing case group, or omit to create a new group for this unit. */
  caseGroupId?: string;
  articles?: CaseArticleDraft[];
  attributes?: Record<string, FactValue>;
}

/**
 * A derived index belongs to a generation of the case base. Any change to
 * cases, their attributes/articles, or configuration advances the generation.
 * This is index consistency bookkeeping, not case version history.
 */
export interface CaseBaseGeneration {
  generation: number;
  updatedAt: string;
}

export interface AppConfigEntry<T = unknown> {
  key: string;
  value: T;
  updatedAt: string;
}

export interface DatabaseStatus {
  schemaVersion: string | null;
  caseUnits: number;
  caseGroups: number;
  sourceDocuments: number;
  sourceAliases: number;
  generation: number;
}
