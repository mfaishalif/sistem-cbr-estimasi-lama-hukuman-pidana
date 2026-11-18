/**
 * Optional structured-attribute comparisons.
 *
 * A missing value is never treated as zero, "none", or a perfect match. It is
 * simply not comparable, and the caller reports the reduced coverage. Numeric
 * scales are fitted on the same reference (training) cases as the TF-IDF model.
 */

import type {
  AttributeComponentConfig,
  AttributeComparator,
  RetrievalConfig,
} from './config';
import type { CaseArticleDraft, CaseFacts, FactValue } from './model';
import { normalizeNarrative } from './text';

export type NumericTransform = 'linear' | 'log';

export interface NumericScale {
  min: number;
  max: number;
  transform: NumericTransform;
}

export type NumericScales = ReadonlyMap<string, NumericScale>;

export type ExtractedAttribute =
  | { kind: 'number'; key: string; value: number }
  | { kind: 'categorical'; key: string; value: string }
  | { kind: 'set'; key: string; values: readonly string[] };

export interface AttributeComparisonDetail {
  queryValue: number | string | readonly string[];
  candidateValue: number | string | readonly string[];
  numericScale?: NumericScale;
  referenceDateGapDays?: number;
  intersection?: readonly string[];
  union?: readonly string[];
}

export interface AttributeComparison {
  key: string;
  comparator: AttributeComparator;
  similarity: number;
  detail: AttributeComparisonDetail;
}

function attributeValue(facts: CaseFacts, key: string): FactValue | undefined {
  return facts.attributes?.[key];
}

function normalizedText(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized === '' ? null : normalized;
}

function parseSet(value: FactValue): string[] | null {
  if (value.type !== 'set') {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value.value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    return null;
  }
  const values = [
    ...new Set(
      parsed
        .map((item) => normalizedText(item))
        .filter((item): item is string => item !== null),
    ),
  ].sort();
  return values.length === 0 ? null : values;
}

function normalizeReferenceDate(facts: CaseFacts, component: AttributeComponentConfig): number | null {
  if (component.requireReferenceDate !== true) {
    return null;
  }
  if (component.attributeKey !== 'age_years') {
    return null;
  }
  const companion = attributeValue(facts, 'age_reference_date');
  if (companion === undefined || companion.type !== 'text') {
    return null;
  }
  const parsed = Date.parse(companion.value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Extract one comparable attribute. Returns null for an absent value and for
 * a value that cannot be compared safely (for example an age without a
 * reference date).
 */
export function extractAttribute(
  facts: CaseFacts,
  component: AttributeComponentConfig,
): ExtractedAttribute | null {
  const value = attributeValue(facts, component.attributeKey);
  if (value === undefined) {
    return null;
  }

  switch (component.comparator) {
    case 'number-range':
    case 'number-log-range': {
      if (value.type !== 'number' || !Number.isFinite(value.value)) {
        return null;
      }
      if (component.requireReferenceDate === true) {
        // The value is only comparable with a known, comparable reference date.
        const referenceDate = normalizeReferenceDate(facts, component);
        if (referenceDate === null) {
          return null;
        }
      }
      if (
        component.comparator === 'number-log-range' &&
        value.value < 0
      ) {
        return null;
      }
      return { kind: 'number', key: component.attributeKey, value: value.value };
    }
    case 'categorical': {
      if (value.type === 'number') {
        return null;
      }
      if (value.type === 'boolean') {
        return {
          kind: 'categorical',
          key: component.attributeKey,
          value: value.value ? 'true' : 'false',
        };
      }
      const text = normalizedText(value.value);
      return text === null
        ? null
        : { kind: 'categorical', key: component.attributeKey, value: text };
    }
    case 'set': {
      const values = parseSet(value);
      return values === null
        ? null
        : { kind: 'set', key: component.attributeKey, values };
    }
    default:
      return null;
  }
}

function numericTransformValue(
  value: number,
  transform: NumericTransform,
): number | null {
  if (transform === 'linear') {
    return value;
  }
  return value < 0 ? null : Math.log1p(value);
}

/** Fit numeric ranges from reference cases only. */
export function fitNumericScales(
  cases: readonly CaseFacts[],
  config: RetrievalConfig,
): NumericScales {
  const scales = new Map<string, NumericScale>();

  for (const component of config.components.attributes) {
    if (component.weight === 0) {
      continue;
    }
    if (
      component.comparator !== 'number-range' &&
      component.comparator !== 'number-log-range'
    ) {
      continue;
    }

    const transform: NumericTransform =
      component.comparator === 'number-log-range' ? 'log' : 'linear';
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const facts of cases) {
      const extracted = extractAttribute(facts, component);
      if (extracted === null || extracted.kind !== 'number') {
        continue;
      }
      const value = numericTransformValue(extracted.value, transform);
      if (value === null) {
        continue;
      }
      min = Math.min(min, value);
      max = Math.max(max, value);
    }

    if (min !== Number.POSITIVE_INFINITY) {
      scales.set(component.attributeKey, { min, max, transform });
    }
  }

  return scales;
}

function clampUnit(value: number): number {
  if (value < 0) {
    return 0;
  }
  return value > 1 ? 1 : value;
}

function jaccard(left: readonly string[], right: readonly string[]): {
  similarity: number;
  intersection: string[];
  union: string[];
} {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((value) => rightSet.has(value)).sort();
  const union = [...new Set([...leftSet, ...rightSet])].sort();
  return {
    similarity: union.length === 0 ? 0 : intersection.length / union.length,
    intersection,
    union,
  };
}

/**
 * Compare one attribute for a candidate. The caller must only call this when
 * both sides extracted a value.
 */
export function compareAttribute(
  component: AttributeComponentConfig,
  query: ExtractedAttribute,
  candidate: ExtractedAttribute,
  scales: NumericScales,
): AttributeComparison {
  if (query.kind !== candidate.kind) {
    throw new Error(`attribute ${component.attributeKey} has mismatched value kinds`);
  }

  if (query.kind === 'categorical' && candidate.kind === 'categorical') {
    return {
      key: component.attributeKey,
      comparator: component.comparator,
      similarity: query.value === candidate.value ? 1 : 0,
      detail: { queryValue: query.value, candidateValue: candidate.value },
    };
  }

  if (query.kind === 'set' && candidate.kind === 'set') {
    const compared = jaccard(query.values, candidate.values);
    return {
      key: component.attributeKey,
      comparator: component.comparator,
      similarity: clampUnit(compared.similarity),
      detail: {
        queryValue: query.values,
        candidateValue: candidate.values,
        intersection: compared.intersection,
        union: compared.union,
      },
    };
  }

  if (query.kind === 'number' && candidate.kind === 'number') {
    const scale = scales.get(component.attributeKey);
    if (scale === undefined || scale.max === scale.min) {
      return {
        key: component.attributeKey,
        comparator: component.comparator,
        similarity: query.value === candidate.value ? 1 : 0,
        detail: { queryValue: query.value, candidateValue: candidate.value },
      };
    }

    const queryValue = numericTransformValue(query.value, scale.transform);
    const candidateValue = numericTransformValue(candidate.value, scale.transform);
    if (queryValue === null || candidateValue === null) {
      throw new Error(`attribute ${component.attributeKey} cannot use ${scale.transform} scale`);
    }

    return {
      key: component.attributeKey,
      comparator: component.comparator,
      similarity: clampUnit(1 - Math.abs(queryValue - candidateValue) / (scale.max - scale.min)),
      detail: {
        queryValue: query.value,
        candidateValue: candidate.value,
        numericScale: scale,
      },
    };
  }

  throw new Error(`attribute ${component.attributeKey} has unsupported value kinds`);
}

/**
 * Two ages are only compared when the dates the ages refer to are known and
 * sufficiently close. An age without a reference date is not comparable.
 */
export function compareReferenceDates(
  queryFacts: CaseFacts,
  candidateFacts: CaseFacts,
  component: AttributeComponentConfig,
): { comparable: boolean; gapDays: number | null } {
  if (component.requireReferenceDate !== true) {
    return { comparable: true, gapDays: null };
  }
  const queryDate = normalizeReferenceDate(queryFacts, component);
  const candidateDate = normalizeReferenceDate(candidateFacts, component);
  if (queryDate === null || candidateDate === null) {
    return { comparable: false, gapDays: null };
  }
  const gapDays = Math.abs(queryDate - candidateDate) / 86_400_000;
  const maxGapDays = component.maxReferenceDateGapDays;
  return {
    comparable: maxGapDays === undefined || gapDays <= maxGapDays,
    gapDays,
  };
}

export function referenceDatesAreComparable(
  queryFacts: CaseFacts,
  candidateFacts: CaseFacts,
  component: AttributeComponentConfig,
): boolean {
  return compareReferenceDates(queryFacts, candidateFacts, component).comparable;
}

export function referenceDateGapDays(
  queryFacts: CaseFacts,
  candidateFacts: CaseFacts,
  component: AttributeComponentConfig,
): number | null {
  return compareReferenceDates(queryFacts, candidateFacts, component).gapDays;
}

export function normalizeCategoryName(category: string | null | undefined): string | null {
  if (category === null || category === undefined) {
    return null;
  }
  const normalized = normalizeNarrative(category);
  return normalized === '' ? null : normalized;
}

export function articleReferences(
  articles: readonly CaseArticleDraft[] | undefined,
): string[] {
  if (articles === undefined) {
    return [];
  }
  const references = new Set<string>();
  for (const article of articles) {
    const explicit = article.normalizedReference?.trim();
    if (explicit !== undefined && explicit !== '') {
      references.add(explicit.toLowerCase());
      continue;
    }
    const parts = [article.law, article.article, article.paragraph ?? '']
      .map((part) => part.trim().toLowerCase().replace(/\s+/g, ' '))
      .filter((part) => part !== '');
    if (parts.length >= 2) {
      references.add(parts.join('|'));
    }
  }
  return [...references].sort();
}

export function compareArticles(
  queryArticles: readonly string[],
  candidateArticles: readonly string[],
): { similarity: number; intersection: string[]; union: string[] } {
  return jaccard(queryArticles, candidateArticles);
}
