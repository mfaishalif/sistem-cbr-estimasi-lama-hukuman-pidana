/**
 * Retrieval configuration.
 *
 * The engine accepts every scoring parameter from the caller. The defaults
 * below are conservative placeholders for local use and synthetic tests; they
 * are not the result of validation on the imported case base. The evaluation
 * work chooses and locks the final weights, `k`, score threshold, coverage
 * threshold, and minimum reference count separately.
 */

export type AttributeComparator =
  | 'categorical'
  | 'set'
  | 'number-range'
  | 'number-log-range';

export interface AttributeComponentConfig {
  attributeKey: string;
  weight: number;
  comparator: AttributeComparator;
  /**
   * Only compare the numeric value when both cases carry the companion
   * reference date (currently `age_reference_date` for `age_years`).
   */
  requireReferenceDate?: boolean;
  /** Maximum distance between the two reference dates, in days. */
  maxReferenceDateGapDays?: number;
}

export interface PreprocessingConfig {
  minTokenLength: number;
  stopwords: readonly string[];
  /** Log-scaled term frequency instead of raw counts. */
  sublinearTermFrequency: boolean;
  /** Smoothed inverse document frequency: ln((N + 1) / (df + 1)) + 1. */
  smoothInverseDocumentFrequency: boolean;
}

export interface ScoringComponentsConfig {
  narrativeWeight: number;
  articleWeight: number;
  attributes: readonly AttributeComponentConfig[];
}

export interface RetrievalLimitsConfig {
  maxReferences: number;
  minReferences: number;
  /** A candidate must score strictly above this value. */
  minScore: number;
  /** Minimum share of query-known optional weight compared on both sides. */
  minAttributeCoverage: number;
}

export interface RetrievalConfig {
  version: 1;
  preprocessing: PreprocessingConfig;
  components: ScoringComponentsConfig;
  /** Restrict to the query category only when the query states one. */
  categoryRestriction: 'when-known' | 'never';
  retrieval: RetrievalLimitsConfig;
  /** Recorded rounding rule for the human-readable day value. */
  rounding: 'nearest-day-half-up';
}

export type RetrievalConfigOverrides = {
  preprocessing?: Partial<PreprocessingConfig>;
  components?: Partial<Omit<ScoringComponentsConfig, 'attributes'>> & {
    attributes?: readonly AttributeComponentConfig[];
  };
  categoryRestriction?: RetrievalConfig['categoryRestriction'];
  retrieval?: Partial<RetrievalLimitsConfig>;
  rounding?: RetrievalConfig['rounding'];
};

const ATTRIBUTE_COMPONENTS: readonly AttributeComponentConfig[] = [
  {
    attributeKey: 'age_years',
    weight: 0.2,
    comparator: 'number-range',
    requireReferenceDate: true,
    maxReferenceDateGapDays: 366,
  },
  { attributeKey: 'gender', weight: 0.1, comparator: 'categorical' },
  { attributeKey: 'occupation', weight: 0.15, comparator: 'categorical' },
  { attributeKey: 'education', weight: 0.1, comparator: 'categorical' },
  { attributeKey: 'role', weight: 0.2, comparator: 'categorical' },
  { attributeKey: 'victim_count', weight: 0.15, comparator: 'number-range' },
  { attributeKey: 'victim_harm', weight: 0.2, comparator: 'set' },
  { attributeKey: 'loss_amount_idr', weight: 0.2, comparator: 'number-log-range' },
  { attributeKey: 'weapon_or_mode', weight: 0.2, comparator: 'set' },
  { attributeKey: 'prior_conviction', weight: 0.15, comparator: 'categorical' },
];

export const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  version: 1,
  preprocessing: {
    minTokenLength: 2,
    stopwords: [],
    sublinearTermFrequency: true,
    smoothInverseDocumentFrequency: true,
  },
  components: {
    narrativeWeight: 1,
    articleWeight: 0.5,
    attributes: ATTRIBUTE_COMPONENTS,
  },
  categoryRestriction: 'when-known',
  retrieval: {
    maxReferences: 5,
    minReferences: 1,
    minScore: 0,
    minAttributeCoverage: 0,
  },
  rounding: 'nearest-day-half-up',
};

export class RetrievalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetrievalConfigError';
  }
}

function requireFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RetrievalConfigError(`${label} must be a finite number`);
  }
}

function requireRange(value: number, label: string, min: number, max: number): void {
  requireFiniteNumber(value, label);
  if (value < min || value > max) {
    throw new RetrievalConfigError(`${label} must be between ${min} and ${max}`);
  }
}

function requireInteger(value: number, label: string, min: number): void {
  requireFiniteNumber(value, label);
  if (!Number.isInteger(value) || value < min) {
    throw new RetrievalConfigError(`${label} must be an integer of at least ${min}`);
  }
}

const COMPARATORS: readonly AttributeComparator[] = [
  'categorical',
  'set',
  'number-range',
  'number-log-range',
];

export function validateRetrievalConfig(config: RetrievalConfig): void {
  if (config.version !== 1) {
    throw new RetrievalConfigError('version must be 1');
  }
  if (config.categoryRestriction !== 'when-known' && config.categoryRestriction !== 'never') {
    throw new RetrievalConfigError('categoryRestriction must be "when-known" or "never"');
  }
  if (config.rounding !== 'nearest-day-half-up') {
    throw new RetrievalConfigError('rounding must be "nearest-day-half-up"');
  }

  requireInteger(config.preprocessing.minTokenLength, 'preprocessing.minTokenLength', 1);
  requireInteger(config.retrieval.maxReferences, 'retrieval.maxReferences', 1);
  requireInteger(config.retrieval.minReferences, 'retrieval.minReferences', 1);
  if (config.retrieval.minReferences > config.retrieval.maxReferences) {
    throw new RetrievalConfigError('retrieval.minReferences must not exceed maxReferences');
  }
  requireRange(config.retrieval.minScore, 'retrieval.minScore', 0, 1);
  requireRange(
    config.retrieval.minAttributeCoverage,
    'retrieval.minAttributeCoverage',
    0,
    1,
  );

  requireFiniteNumber(config.components.narrativeWeight, 'components.narrativeWeight');
  requireFiniteNumber(config.components.articleWeight, 'components.articleWeight');
  if (config.components.narrativeWeight <= 0) {
    throw new RetrievalConfigError('components.narrativeWeight must be positive');
  }
  if (config.components.articleWeight < 0) {
    throw new RetrievalConfigError('components.articleWeight must not be negative');
  }

  const seenKeys = new Set<string>();
  for (const component of config.components.attributes) {
    if (component.attributeKey.trim() === '') {
      throw new RetrievalConfigError('attribute component keys must not be empty');
    }
    if (seenKeys.has(component.attributeKey)) {
      throw new RetrievalConfigError(
        `duplicate attribute component: ${component.attributeKey}`,
      );
    }
    seenKeys.add(component.attributeKey);
    if (!COMPARATORS.includes(component.comparator)) {
      throw new RetrievalConfigError(
        `unknown comparator for ${component.attributeKey}: ${component.comparator}`,
      );
    }
    requireFiniteNumber(component.weight, `attribute ${component.attributeKey} weight`);
    if (component.weight < 0) {
      throw new RetrievalConfigError(
        `attribute ${component.attributeKey} weight must not be negative`,
      );
    }
    if (component.maxReferenceDateGapDays !== undefined) {
      requireFiniteNumber(
        component.maxReferenceDateGapDays,
        `attribute ${component.attributeKey} maxReferenceDateGapDays`,
      );
      if (component.maxReferenceDateGapDays < 0) {
        throw new RetrievalConfigError(
          `attribute ${component.attributeKey} maxReferenceDateGapDays must not be negative`,
        );
      }
    }
  }
}

/** Merge caller overrides with the placeholder defaults and validate the result. */
export function resolveRetrievalConfig(
  overrides: RetrievalConfigOverrides = {},
): RetrievalConfig {
  const resolved: RetrievalConfig = {
    version: 1,
    preprocessing: {
      ...DEFAULT_RETRIEVAL_CONFIG.preprocessing,
      ...overrides.preprocessing,
      stopwords: [...(overrides.preprocessing?.stopwords ?? DEFAULT_RETRIEVAL_CONFIG.preprocessing.stopwords)],
    },
    components: {
      narrativeWeight:
        overrides.components?.narrativeWeight ??
        DEFAULT_RETRIEVAL_CONFIG.components.narrativeWeight,
      articleWeight:
        overrides.components?.articleWeight ??
        DEFAULT_RETRIEVAL_CONFIG.components.articleWeight,
      attributes: [
        ...(overrides.components?.attributes ??
          DEFAULT_RETRIEVAL_CONFIG.components.attributes),
      ],
    },
    categoryRestriction:
      overrides.categoryRestriction ?? DEFAULT_RETRIEVAL_CONFIG.categoryRestriction,
    retrieval: {
      ...DEFAULT_RETRIEVAL_CONFIG.retrieval,
      ...overrides.retrieval,
    },
    rounding: overrides.rounding ?? DEFAULT_RETRIEVAL_CONFIG.rounding,
  };

  validateRetrievalConfig(resolved);
  return resolved;
}

/** Stable JSON: object keys are sorted, arrays keep their order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

/** FNV-1a 64-bit hex. Used only for cache bookkeeping, not security. */
export function stableHash(value: unknown): string {
  const input = stableStringify(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, '0');
}

/**
 * Fingerprint of everything that can change index contents. This is cache
 * bookkeeping, not case version history.
 */
export function retrievalConfigFingerprint(config: RetrievalConfig): string {
  return stableHash(config);
}
