import type {
  CaseArticleDraft,
  CaseUnitDraft,
  FactValue,
} from '@cbr/core';
import {
  ValidationError,
  validateArticleDraft,
  validateFactValue,
} from '@cbr/data';

type JsonObject = Record<string, unknown>;

function asObject(value: unknown, field: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${field} harus berupa objek`);
  }
  return value as JsonObject;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${field} wajib diisi`);
  }
  return value.trim();
}

function optionalText(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} harus berupa teks`);
  }
  return value.trim() || null;
}

function parseArticles(value: unknown): CaseArticleDraft[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new ValidationError('articles harus berupa daftar');
  }
  return value.map((item, index) => {
    const article = asObject(item, `articles[${index}]`);
    return validateArticleDraft({
      law: requiredText(article.law, `articles[${index}].law`),
      article: requiredText(article.article, `articles[${index}].article`),
      paragraph: optionalText(article.paragraph, `articles[${index}].paragraph`),
      arrangement:
        article.arrangement === undefined
          ? 'primary'
          : (article.arrangement as CaseArticleDraft['arrangement']),
      normalizedReference: optionalText(
        article.normalizedReference,
        `articles[${index}].normalizedReference`,
      ) ?? undefined,
      rawText: optionalText(article.rawText, `articles[${index}].rawText`),
      sourceLocation: optionalText(
        article.sourceLocation,
        `articles[${index}].sourceLocation`,
      ),
    });
  });
}

function parseFactValue(value: unknown, key: string): FactValue {
  const fact = asObject(value, `attributes.${key}`);
  const type = fact.type;
  if (
    type !== 'text' &&
    type !== 'number' &&
    type !== 'boolean' &&
    type !== 'enum' &&
    type !== 'set'
  ) {
    throw new ValidationError(`attributes.${key}.type tidak dikenal`);
  }

  const parsed = {
    type,
    value: fact.value,
    ...(fact.unit === undefined ? {} : { unit: optionalText(fact.unit, `attributes.${key}.unit`) }),
    ...(fact.sourceLocation === undefined
      ? {}
      : {
          sourceLocation: optionalText(
            fact.sourceLocation,
            `attributes.${key}.sourceLocation`,
          ),
        }),
  } as FactValue;

  return validateFactValue(key, parsed);
}

function parseAttributes(value: unknown): Record<string, FactValue> {
  if (value === undefined || value === null) {
    return {};
  }
  const attributes = asObject(value, 'attributes');
  const parsed: Record<string, FactValue> = {};
  for (const [key, fact] of Object.entries(attributes)) {
    const trimmedKey = key.trim();
    if (trimmedKey === '') {
      throw new ValidationError('attributes tidak boleh memuat kunci kosong');
    }
    parsed[trimmedKey] = parseFactValue(fact, trimmedKey);
  }
  return parsed;
}

function parseOutcome(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new ValidationError(
      'actualSentenceDays harus berupa bilangan bulat tidak negatif',
    );
  }
  return value;
}

/** Facts of one new case; identity is separate because retrieval ignores it. */
export interface ParsedFacts {
  narration: string;
  category: string | null;
  categorySourceLocation: string | null;
  articles: CaseArticleDraft[];
  attributes: Record<string, FactValue>;
}

export function parseFacts(value: unknown): ParsedFacts {
  const facts = asObject(value, 'facts');
  return {
    narration: requiredText(facts.narration, 'narration'),
    category: optionalText(facts.category, 'category'),
    categorySourceLocation: optionalText(
      facts.categorySourceLocation,
      'categorySourceLocation',
    ),
    articles: parseArticles(facts.articles),
    attributes: parseAttributes(facts.attributes),
  };
}

export interface ParsedEstimateRequest {
  facts: ParsedFacts;
  excludeCaseUnitIds: string[];
}

export function parseEstimateRequest(value: unknown): ParsedEstimateRequest {
  const body = asObject(value, 'permintaan');
  const excluded = body.excludeCaseUnitIds;
  if (
    excluded !== undefined &&
    (!Array.isArray(excluded) || excluded.some((item) => typeof item !== 'string'))
  ) {
    throw new ValidationError('excludeCaseUnitIds harus berupa daftar ID teks');
  }

  return {
    facts: parseFacts(body.facts ?? body),
    excludeCaseUnitIds: (excluded as string[] | undefined) ?? [],
  };
}

/** Full case-unit draft used by create, update, and Retain. */
export function parseCaseDraft(value: unknown): CaseUnitDraft {
  const body = asObject(value, 'kasus');
  return {
    court: requiredText(body.court, 'court'),
    caseNumber: requiredText(body.caseNumber, 'caseNumber'),
    defendantName: optionalText(body.defendantName, 'defendantName'),
    ...parseFacts(body),
    ...(body.actualSentenceDays === undefined
      ? {}
      : { actualSentenceDays: parseOutcome(body.actualSentenceDays) }),
    ...(body.caseGroupId === undefined
      ? {}
      : { caseGroupId: optionalText(body.caseGroupId, 'caseGroupId') ?? undefined }),
  };
}

export function parseOutcomeUpdate(value: unknown): number | null {
  const body = asObject(value, 'hasil aktual');
  if (!('actualSentenceDays' in body)) {
    throw new ValidationError('actualSentenceDays wajib dikirim');
  }
  return parseOutcome(body.actualSentenceDays);
}
