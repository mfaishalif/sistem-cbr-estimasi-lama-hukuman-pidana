import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type {
  AppConfigEntry,
  CaseArticle,
  CaseArticleDraft,
  CaseBaseGeneration,
  CaseUnit,
  CaseUnitDraft,
  DatabaseStatus,
  FactValue,
  NormalizedCaseIdentity,
} from '@cbr/core';
import { getSchemaVersion } from './migrations';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

interface CaseUnitRow {
  id: string;
  case_group_id: string;
  court: string;
  case_number: string;
  defendant_name: string | null;
  narration: string;
  category: string | null;
  category_source_location: string | null;
  actual_sentence_days: number | null;
  created_at: string;
  updated_at: string;
}

interface CaseArticleRow {
  law: string;
  article: string;
  paragraph: string | null;
  arrangement: string;
  normalized_reference: string;
  raw_text: string | null;
  source_location: string | null;
}

interface FactAttributeRow {
  attribute_key: string;
  value_type: 'text' | 'number' | 'boolean' | 'enum' | 'set';
  value_text: string | null;
  value_number: number | null;
  value_unit: string | null;
  source_location: string | null;
}

function requireText(value: string | null | undefined, field: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new ValidationError(`${field} is required`);
  }
  return trimmed;
}

/**
 * Basic identity normalization for matching: case-insensitive, collapsed
 * whitespace, no surrounding punctuation. Legal abbreviation expansion belongs
 * to import validation and can refine this without changing storage shape.
 */
export function normalizeCaseIdentity(court: string, caseNumber: string): NormalizedCaseIdentity {
  const normalizePart = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[.,]/g, '')
      .replace(/\s+/g, ' ');

  return {
    court: normalizePart(court),
    caseNumber: normalizePart(caseNumber),
  };
}

const requiredAttributeTypes: Record<string, FactValue['type']> = {
  age_years: 'number',
  victim_count: 'number',
  loss_amount_idr: 'number',
};

const allowedEnumValues: Record<string, readonly string[]> = {
  prior_conviction: ['yes', 'no'],
};

function normalizeArticleReference(
  law: string,
  article: string,
  paragraph?: string | null,
): string {
  const parts = [law, article, paragraph ?? ''].map((part) =>
    part.trim().toLowerCase().replace(/\s+/g, ' '),
  );
  return parts.filter((part) => part.length > 0).join('|');
}

function validateArticle(article: CaseArticleDraft): CaseArticle {
  const law = requireText(article.law, 'article.law');
  const articleNumber = requireText(article.article, 'article.article');
  const paragraph = article.paragraph?.trim() || null;
  const arrangement = article.arrangement ?? 'primary';

  if (!['primary', 'alternative', 'subsidiary'].includes(arrangement)) {
    throw new ValidationError(`unknown article arrangement: ${arrangement}`);
  }

  return {
    law,
    article: articleNumber,
    paragraph,
    arrangement,
    normalizedReference:
      article.normalizedReference?.trim() ||
      normalizeArticleReference(law, articleNumber, paragraph),
    rawText: article.rawText?.trim() || null,
    sourceLocation: article.sourceLocation?.trim() || null,
  };
}

function validateFactValue(key: string, value: FactValue): FactValue {
  const attributeKey = requireText(key, 'attribute key');

  const requiredType = requiredAttributeTypes[attributeKey];
  if (requiredType !== undefined && value.type !== requiredType) {
    throw new ValidationError(`attribute ${attributeKey} must use type ${requiredType}`);
  }

  const allowedValues = allowedEnumValues[attributeKey];
  if (allowedValues !== undefined) {
    if (value.type !== 'enum' || !allowedValues.includes(value.value)) {
      throw new ValidationError(
        `attribute ${attributeKey} must be an enum with one of: ${allowedValues.join(', ')}`,
      );
    }
  }

  switch (value.type) {
    case 'number':
      if (!Number.isFinite(value.value)) {
        throw new ValidationError(`attribute ${attributeKey} must be a finite number`);
      }
      return value;
    case 'boolean':
      if (typeof value.value !== 'boolean') {
        throw new ValidationError(`attribute ${attributeKey} must be a boolean`);
      }
      return value;
    case 'text':
    case 'enum':
      return { ...value, value: requireText(value.value, `attribute ${attributeKey}`) };
    case 'set': {
      let parsed: unknown;
      try {
        parsed = JSON.parse(value.value);
      } catch {
        throw new ValidationError(
          `attribute ${attributeKey} of type set must be a JSON array of strings`,
        );
      }
      if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
        throw new ValidationError(
          `attribute ${attributeKey} of type set must be a JSON array of strings`,
        );
      }
      return value;
    }
    default:
      throw new ValidationError(`attribute ${attributeKey} has an unknown value type`);
  }
}

function insertFactAttribute(
  db: DatabaseSync,
  caseUnitId: string,
  key: string,
  value: FactValue,
): void {
  const columns = {
    text: null as string | null,
    number: null as number | null,
  };

  if (value.type === 'boolean') {
    columns.number = value.value ? 1 : 0;
  } else if (value.type === 'number') {
    columns.number = value.value;
  } else {
    columns.text = value.value;
  }

  db.prepare(
    `INSERT INTO case_fact_attribute
       (case_unit_id, attribute_key, value_type, value_text, value_number, value_unit,
        source_location)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    caseUnitId,
    key,
    value.type,
    columns.text,
    columns.number,
    'unit' in value ? value.unit ?? null : null,
    value.sourceLocation?.trim() || null,
  );
}

/**
 * Create one case unit. If `caseGroupId` is omitted a new case group is created.
 * Returns the stable internal case unit ID.
 */
export function createCaseUnit(
  db: DatabaseSync,
  draft: CaseUnitDraft,
  idFactory: () => string = randomUUID,
): string {
  const court = requireText(draft.court, 'court');
  const caseNumber = requireText(draft.caseNumber, 'caseNumber');
  const narration = requireText(draft.narration, 'narration');
  const defendantName = draft.defendantName?.trim() || null;
  const category = draft.category?.trim() || null;
  const categorySourceLocation = draft.categorySourceLocation?.trim() || null;
  const actualSentenceDays = draft.actualSentenceDays ?? null;
  const identity = normalizeCaseIdentity(court, caseNumber);

  if (
    actualSentenceDays !== null &&
    (!Number.isInteger(actualSentenceDays) || actualSentenceDays < 0)
  ) {
    throw new ValidationError(
      'actualSentenceDays must be a non-negative integer when known',
    );
  }

  const articles = (draft.articles ?? []).map(validateArticle);
  const attributes = Object.entries(draft.attributes ?? {}).map(([key, value]) => ({
    key: requireText(key, 'attribute key'),
    value: validateFactValue(key, value),
  }));

  const unitId = idFactory();
  let caseGroupId = draft.caseGroupId?.trim() || null;

  db.exec('BEGIN IMMEDIATE');
  try {
    if (caseGroupId !== null) {
      const group = db
        .prepare('SELECT id FROM case_group WHERE id = ?')
        .get(caseGroupId) as { id: string } | undefined;
      if (group === undefined) {
        throw new ValidationError(`unknown caseGroupId: ${caseGroupId}`);
      }
    } else {
      caseGroupId = idFactory();
      db.prepare('INSERT INTO case_group (id) VALUES (?)').run(caseGroupId);
    }

    db.prepare(
      `INSERT INTO case_unit
         (id, case_group_id, court, case_number, court_normalized, case_number_normalized,
          defendant_name, narration, category, category_source_location, actual_sentence_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      unitId,
      caseGroupId,
      court,
      caseNumber,
      identity.court,
      identity.caseNumber,
      defendantName,
      narration,
      category,
      categorySourceLocation,
      actualSentenceDays,
    );

    const insertArticle = db.prepare(
      `INSERT INTO case_article
         (id, case_unit_id, law, article, paragraph, arrangement, normalized_reference,
          raw_text, source_location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const article of articles) {
      insertArticle.run(
        idFactory(),
        unitId,
        article.law,
        article.article,
        article.paragraph ?? null,
        article.arrangement ?? 'primary',
        article.normalizedReference,
        article.rawText ?? null,
        article.sourceLocation ?? null,
      );
    }

    for (const attribute of attributes) {
      insertFactAttribute(db, unitId, attribute.key, attribute.value);
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return unitId;
}

function rowToArticle(row: CaseArticleRow): CaseArticle {
  return {
    law: row.law,
    article: row.article,
    paragraph: row.paragraph,
    arrangement: row.arrangement as CaseArticle['arrangement'],
    normalizedReference: row.normalized_reference,
    rawText: row.raw_text,
    sourceLocation: row.source_location,
  };
}

function requiredColumn<T>(value: T | null, attribute: string, column: string): T {
  if (value === null) {
    throw new Error(`attribute ${attribute} is missing its ${column} value`);
  }
  return value;
}

function withSourceLocation<T extends FactValue>(value: T, sourceLocation: string | null): T {
  return sourceLocation === null ? value : { ...value, sourceLocation };
}

function rowToFactValue(row: FactAttributeRow): FactValue {
  if (row.value_type === 'boolean') {
    return withSourceLocation(
      {
        type: 'boolean',
        value: requiredColumn(row.value_number, row.attribute_key, 'value_number') === 1,
      },
      row.source_location,
    );
  }
  if (row.value_type === 'number') {
    return withSourceLocation(
      {
        type: 'number',
        value: requiredColumn(row.value_number, row.attribute_key, 'value_number'),
        ...(row.value_unit === null ? {} : { unit: row.value_unit }),
      },
      row.source_location,
    );
  }

  return withSourceLocation(
    {
      type: row.value_type,
      value: requiredColumn(row.value_text, row.attribute_key, 'value_text'),
      ...(row.value_unit === null ? {} : { unit: row.value_unit }),
    },
    row.source_location,
  );
}

export function getCaseUnit(db: DatabaseSync, caseUnitId: string): CaseUnit | null {
  const row = db
    .prepare('SELECT * FROM case_unit WHERE id = ?')
    .get(caseUnitId) as CaseUnitRow | undefined;

  if (row === undefined) {
    return null;
  }

  const articleRows = db
    .prepare('SELECT * FROM case_article WHERE case_unit_id = ? ORDER BY rowid')
    .all(caseUnitId) as unknown as CaseArticleRow[];

  const attributeRows = db
    .prepare('SELECT * FROM case_fact_attribute WHERE case_unit_id = ? ORDER BY attribute_key')
    .all(caseUnitId) as unknown as FactAttributeRow[];

  const attributes: Record<string, FactValue> = {};
  for (const attribute of attributeRows) {
    attributes[attribute.attribute_key] = rowToFactValue(attribute);
  }

  return {
    id: row.id,
    caseGroupId: row.case_group_id,
    identity: {
      court: row.court,
      caseNumber: row.case_number,
      defendantName: row.defendant_name,
    },
    facts: {
      narration: row.narration,
      category: row.category,
      categorySourceLocation: row.category_source_location,
      articles: articleRows.map(rowToArticle),
      attributes,
    },
    outcome: { actualSentenceDays: row.actual_sentence_days },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listCaseUnits(db: DatabaseSync, limit = 50): CaseUnit[] {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const rows = db
    .prepare('SELECT id FROM case_unit ORDER BY created_at, id LIMIT ?')
    .all(safeLimit) as Array<{ id: string }>;

  return rows
    .map((row) => getCaseUnit(db, row.id))
    .filter((unit): unit is CaseUnit => unit !== null);
}

export function countCaseUnits(db: DatabaseSync): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM case_unit').get() as { count: number };
  return row.count;
}

export function countCaseGroups(db: DatabaseSync): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM case_group').get() as { count: number };
  return row.count;
}

export function getCaseBaseGeneration(db: DatabaseSync): CaseBaseGeneration {
  const row = db
    .prepare('SELECT generation, updated_at FROM case_base_generation WHERE id = 1')
    .get() as { generation: number; updated_at: string } | undefined;

  if (row === undefined) {
    throw new Error('case_base_generation row is missing; run migrations first');
  }

  return { generation: row.generation, updatedAt: row.updated_at };
}

export function getDatabaseStatus(db: DatabaseSync): DatabaseStatus {
  return {
    schemaVersion: getSchemaVersion(db),
    caseUnits: countCaseUnits(db),
    caseGroups: countCaseGroups(db),
    generation: getCaseBaseGeneration(db).generation,
  };
}

export function setConfig<T>(db: DatabaseSync, key: string, value: T): AppConfigEntry<T> {
  const configKey = requireText(key, 'config key');
  db.prepare(
    `INSERT INTO app_config (key, value_json) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE
       SET value_json = excluded.value_json,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
  ).run(configKey, JSON.stringify(value));

  return getConfig<T>(db, configKey) as AppConfigEntry<T>;
}

export function getConfig<T = unknown>(db: DatabaseSync, key: string): AppConfigEntry<T> | null {
  const row = db
    .prepare('SELECT key, value_json, updated_at FROM app_config WHERE key = ?')
    .get(key) as { key: string; value_json: string; updated_at: string } | undefined;

  if (row === undefined) {
    return null;
  }

  return {
    key: row.key,
    value: JSON.parse(row.value_json) as T,
    updatedAt: row.updated_at,
  };
}
