import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  normalizeAttributeValue,
  type AppConfigEntry,
  type CaseArticle,
  type CaseArticleDraft,
  type CaseBaseGeneration,
  type CaseUnit,
  type CaseUnitDraft,
  type DatabaseStatus,
  type FactValue,
  type NormalizedCaseIdentity,
} from '@cbr/core';
import { getSchemaVersion } from './migrations';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface SourceDocumentInput {
  id: string;
  contentHash: string;
  normalizedContentHash?: string | null;
  snapshotPath: string;
  sourceUrl?: string | null;
  retrievedAt?: string | null;
}

export interface SourceDocumentRecord {
  id: string;
  copyOfExisting: boolean;
}

export interface SourceAliasInput {
  id: string;
  sourceDocumentId: string;
  aliasType: 'path' | 'xml_id' | 'url' | 'other';
  aliasValue: string;
}

export interface SourceAliasRecord {
  inserted: boolean;
  conflict: boolean;
  existingSourceDocumentId: string | null;
}

export interface CaseUnitSourceInput {
  caseUnitId: string;
  sourceDocumentId: string;
  narrationLocation?: string | null;
  outcomeLocation?: string | null;
  notes?: string | null;
  sourceOutcomeValue?: string | null;
  sourceOutcomeUnit?: string | null;
  sourceOutcomeKind?: 'metadata' | 'metadata-and-verdict' | null;
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

export interface CaseUnitSourceSummary {
  sourceDocumentId: string;
  contentHash: string;
  snapshotPath: string;
  sourceUrl: string | null;
  narrationLocation: string | null;
  outcomeLocation: string | null;
  aliases: string[];
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

/** Validate and normalize one indictment article. Shared by import, API, and CRUD. */
export function validateArticleDraft(article: CaseArticleDraft): CaseArticle {
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

/** Validate one optional fact value. Shared by import, API, and CRUD. */
export function validateFactValue(key: string, value: FactValue): FactValue {
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

/**
 * Apply the shared attribute-value rule before a value is stored. Values that
 * carry no information ("terdakwa", "-", empty, unknown markers) are dropped
 * by returning null; meaningful free text is kept in canonical form. Evidence
 * source locations are preserved.
 */
export function normalizeFactValue(key: string, value: FactValue): FactValue | null {
  if (value.type === 'text' || value.type === 'enum') {
    if (typeof value.value !== 'string') {
      return value;
    }
    const normalized = normalizeAttributeValue(key, value.value);
    if (normalized === null) {
      return null;
    }
    return { ...value, value: normalized };
  }

  if (value.type === 'set') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value.value);
    } catch {
      // Leave malformed JSON for validateFactValue to reject.
      return value;
    }
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
      return value;
    }
    const values = [
      ...new Set(
        parsed
          .map((item) => normalizeAttributeValue(key, item))
          .filter((item): item is string => item !== null),
      ),
    ].sort();
    if (values.length === 0) {
      return null;
    }
    return { ...value, value: JSON.stringify(values) };
  }

  return value;
}

function normalizedAttributeEntries(
  attributes: Record<string, FactValue> | undefined,
): Array<{ key: string; value: FactValue }> {
  const entries: Array<{ key: string; value: FactValue }> = [];
  for (const [rawKey, rawValue] of Object.entries(attributes ?? {})) {
    const key = requireText(rawKey, 'attribute key');
    const normalized = normalizeFactValue(key, rawValue);
    if (normalized === null) {
      continue;
    }
    entries.push({ key, value: validateFactValue(key, normalized) });
  }
  return entries;
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

  const articles = (draft.articles ?? []).map(validateArticleDraft);
  const attributes = normalizedAttributeEntries(draft.attributes);

  const unitId = idFactory();
  let caseGroupId = draft.caseGroupId?.trim() || null;

  // A savepoint allows bulk imports to wrap many createCaseUnit calls in one
  // transaction while keeping this function usable on its own.
  db.exec('SAVEPOINT create_case_unit');
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

    db.exec('RELEASE create_case_unit');
  } catch (error) {
    db.exec('ROLLBACK TO create_case_unit');
    db.exec('RELEASE create_case_unit');
    throw error;
  }

  return unitId;
}

/**
 * Replace the editable fields of one case unit. Source links and the case
 * group stay intact unless a different existing `caseGroupId` is supplied.
 * Articles and attributes are replaced as a set; an omitted value stays
 * omitted instead of being turned into zero or "none".
 */
export function updateCaseUnit(
  db: DatabaseSync,
  caseUnitId: string,
  draft: CaseUnitDraft,
  idFactory: () => string = randomUUID,
): void {
  const id = requireText(caseUnitId, 'caseUnitId');
  const current = getCaseUnit(db, id);
  if (current === null) {
    throw new ValidationError(`unknown caseUnitId: ${id}`);
  }

  const court = requireText(draft.court, 'court');
  const caseNumber = requireText(draft.caseNumber, 'caseNumber');
  const narration = requireText(draft.narration, 'narration');
  const defendantName = draft.defendantName?.trim() || null;
  const category = draft.category?.trim() || null;
  const categorySourceLocation = draft.categorySourceLocation?.trim() || null;
  const identity = normalizeCaseIdentity(court, caseNumber);
  const actualSentenceDays =
    draft.actualSentenceDays === undefined
      ? current.outcome.actualSentenceDays
      : draft.actualSentenceDays;

  if (
    actualSentenceDays !== null &&
    (!Number.isInteger(actualSentenceDays) || actualSentenceDays < 0)
  ) {
    throw new ValidationError(
      'actualSentenceDays must be a non-negative integer when known',
    );
  }

  const articles = (draft.articles ?? []).map(validateArticleDraft);
  const attributes = normalizedAttributeEntries(draft.attributes);

  const requestedGroupId = draft.caseGroupId?.trim() || null;
  let caseGroupId = current.caseGroupId;
  if (requestedGroupId !== null && requestedGroupId !== current.caseGroupId) {
    const group = db
      .prepare('SELECT id FROM case_group WHERE id = ?')
      .get(requestedGroupId) as { id: string } | undefined;
    if (group === undefined) {
      throw new ValidationError(`unknown caseGroupId: ${requestedGroupId}`);
    }
    caseGroupId = requestedGroupId;
  }

  db.exec('SAVEPOINT update_case_unit');
  try {
    db.prepare(
      `UPDATE case_unit
          SET case_group_id = ?,
              court = ?,
              case_number = ?,
              court_normalized = ?,
              case_number_normalized = ?,
              defendant_name = ?,
              narration = ?,
              category = ?,
              category_source_location = ?,
              actual_sentence_days = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?`,
    ).run(
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
      id,
    );

    db.prepare('DELETE FROM case_article WHERE case_unit_id = ?').run(id);
    db.prepare('DELETE FROM case_fact_attribute WHERE case_unit_id = ?').run(id);

    const insertArticle = db.prepare(
      `INSERT INTO case_article
         (id, case_unit_id, law, article, paragraph, arrangement, normalized_reference,
          raw_text, source_location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const article of articles) {
      insertArticle.run(
        idFactory(),
        id,
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
      insertFactAttribute(db, id, attribute.key, attribute.value);
    }

    db.exec('RELEASE update_case_unit');
  } catch (error) {
    db.exec('ROLLBACK TO update_case_unit');
    db.exec('RELEASE update_case_unit');
    throw error;
  }
}

/**
 * Retain one case unit with a known positive outcome. Retain never copies an
 * estimate; the caller must supply the actual verdict outcome.
 */
export function retainCaseUnit(
  db: DatabaseSync,
  draft: CaseUnitDraft,
  idFactory: () => string = randomUUID,
): string {
  const outcome = draft.actualSentenceDays;
  if (
    outcome === undefined ||
    outcome === null ||
    !Number.isInteger(outcome) ||
    outcome <= 0
  ) {
    throw new ValidationError(
      'retainCaseUnit requires a positive integer actualSentenceDays from the verdict',
    );
  }
  return createCaseUnit(db, draft, idFactory);
}

/**
 * Edit the known actual outcome of a case unit. `null` means the outcome is
 * unknown again. The table trigger advances the case-base generation so an
 * index built from the previous outcome is no longer usable.
 */
export function updateCaseUnitOutcome(
  db: DatabaseSync,
  caseUnitId: string,
  actualSentenceDays: number | null,
): void {
  const id = requireText(caseUnitId, 'caseUnitId');
  if (
    actualSentenceDays !== null &&
    (!Number.isInteger(actualSentenceDays) || actualSentenceDays < 0)
  ) {
    throw new ValidationError(
      'actualSentenceDays must be a non-negative integer when known',
    );
  }

  const result = db
    .prepare(
      `UPDATE case_unit
          SET actual_sentence_days = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?`,
    )
    .run(actualSentenceDays, id);

  if (result.changes === 0) {
    throw new ValidationError(`unknown caseUnitId: ${id}`);
  }
}

/**
 * Delete a case unit. Child articles, attributes, and source links cascade.
 * The generation trigger invalidates derived indexes; no case history is kept.
 */
export function deleteCaseUnit(db: DatabaseSync, caseUnitId: string): boolean {
  const id = requireText(caseUnitId, 'caseUnitId');
  const current = db
    .prepare('SELECT case_group_id FROM case_unit WHERE id = ?')
    .get(id) as { case_group_id: string } | undefined;
  if (current === undefined) {
    return false;
  }

  db.exec('SAVEPOINT delete_case_unit');
  try {
    db.prepare('DELETE FROM case_unit WHERE id = ?').run(id);
    // Keep the group while any other unit in the same case still uses it.
    db.prepare(
      `DELETE FROM case_group
        WHERE id = ?
          AND NOT EXISTS (
            SELECT 1 FROM case_unit WHERE case_group_id = case_group.id
          )`,
    ).run(current.case_group_id);
    db.exec('RELEASE delete_case_unit');
  } catch (error) {
    db.exec('ROLLBACK TO delete_case_unit');
    db.exec('RELEASE delete_case_unit');
    throw error;
  }
  return true;
}

/** Run a callback inside one immediate transaction. */
export function withTransaction<T>(db: DatabaseSync, callback: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Insert a canonical source document. Byte-identical documents and documents
 * that match after format normalization share one canonical row; callers keep
 * every path/ID/URL alias through insertSourceAlias.
 */
export function insertSourceDocument(
  db: DatabaseSync,
  input: SourceDocumentInput,
): SourceDocumentRecord {
  const contentHash = requireText(input.contentHash, 'sourceDocument.contentHash');
  const snapshotPath = requireText(input.snapshotPath, 'sourceDocument.snapshotPath');
  const normalizedContentHash = input.normalizedContentHash?.trim() || null;

  const byContentHash = db
    .prepare('SELECT id FROM source_document WHERE content_hash = ?')
    .get(contentHash) as { id: string } | undefined;

  if (byContentHash !== undefined) {
    return { id: byContentHash.id, copyOfExisting: true };
  }

  if (normalizedContentHash !== null) {
    const byNormalizedHash = db
      .prepare('SELECT id FROM source_document WHERE normalized_content_hash = ?')
      .get(normalizedContentHash) as { id: string } | undefined;

    if (byNormalizedHash !== undefined) {
      return { id: byNormalizedHash.id, copyOfExisting: true };
    }
  }

  db.prepare(
    `INSERT INTO source_document
       (id, content_hash, normalized_content_hash, snapshot_path, source_url, retrieved_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    requireText(input.id, 'sourceDocument.id'),
    contentHash,
    normalizedContentHash,
    snapshotPath,
    input.sourceUrl?.trim() || null,
    input.retrievedAt?.trim() || null,
  );

  return { id: input.id, copyOfExisting: false };
}

/** Record one source identity without silently repointing an existing alias. */
export function insertSourceAlias(db: DatabaseSync, input: SourceAliasInput): SourceAliasRecord {
  const aliasValue = requireText(input.aliasValue, 'sourceAlias.aliasValue');
  const existing = db
    .prepare('SELECT source_document_id FROM source_alias WHERE alias_type = ? AND alias_value = ?')
    .get(input.aliasType, aliasValue) as { source_document_id: string } | undefined;

  if (existing !== undefined) {
    return {
      inserted: false,
      conflict: existing.source_document_id !== input.sourceDocumentId,
      existingSourceDocumentId: existing.source_document_id,
    };
  }

  db.prepare(
    `INSERT INTO source_alias (id, source_document_id, alias_type, alias_value)
     VALUES (?, ?, ?, ?)`,
  ).run(
    requireText(input.id, 'sourceAlias.id'),
    requireText(input.sourceDocumentId, 'sourceAlias.sourceDocumentId'),
    input.aliasType,
    aliasValue,
  );

  return { inserted: true, conflict: false, existingSourceDocumentId: null };
}

/** Create a case group with a caller-supplied stable ID when it does not exist. */
export function ensureCaseGroup(db: DatabaseSync, id: string, label?: string | null): void {
  db.prepare('INSERT OR IGNORE INTO case_group (id, label) VALUES (?, ?)').run(
    requireText(id, 'caseGroup.id'),
    label?.trim() || null,
  );
}

/** Link a case unit to the source document and locations that support it. */
export function linkCaseUnitSource(db: DatabaseSync, input: CaseUnitSourceInput): void {
  db.prepare(
    `INSERT INTO case_unit_source
       (case_unit_id, source_document_id, narration_location, outcome_location, notes,
        source_outcome_value, source_outcome_unit, source_outcome_kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (case_unit_id, source_document_id) DO UPDATE SET
       narration_location = excluded.narration_location,
       outcome_location = excluded.outcome_location,
       notes = excluded.notes,
       source_outcome_value = excluded.source_outcome_value,
       source_outcome_unit = excluded.source_outcome_unit,
       source_outcome_kind = excluded.source_outcome_kind`,
  ).run(
    requireText(input.caseUnitId, 'caseUnitSource.caseUnitId'),
    requireText(input.sourceDocumentId, 'caseUnitSource.sourceDocumentId'),
    input.narrationLocation?.trim() || null,
    input.outcomeLocation?.trim() || null,
    input.notes?.trim() || null,
    input.sourceOutcomeValue?.trim() || null,
    input.sourceOutcomeUnit?.trim() || null,
    input.sourceOutcomeKind ?? null,
  );
}

/**
 * Remove the whole imported case base before a replace import. Application
 * configuration is intentionally kept: it is not part of the imported data.
 */
export function clearCaseBase(db: DatabaseSync): void {
  db.exec(`
    DELETE FROM case_unit_source;
    DELETE FROM case_article;
    DELETE FROM case_fact_attribute;
    DELETE FROM case_unit;
    DELETE FROM case_group;
    DELETE FROM source_alias;
    DELETE FROM source_document;
  `);
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

/** Special category filter value meaning "category IS NULL". */
export const NONE_CATEGORY = '__none__';

export interface CaseUnitListOptions {
  limit?: number;
  offset?: number;
  /** Case-insensitive substring over court, case number, defendant, and category. */
  query?: string;
  /** Exact category slug, or NONE_CATEGORY for units without a category. */
  category?: string;
}

interface CaseFilter {
  where: string;
  parameters: string[];
}

/** One predicate shared by listing and counting so `total` cannot drift. */
function buildCaseFilter(options: Pick<CaseUnitListOptions, 'query' | 'category'>): CaseFilter {
  const clauses: string[] = [];
  const parameters: string[] = [];
  const query = options.query?.trim().toLowerCase() ?? '';

  if (query !== '') {
    const pattern = `%${query}%`;
    clauses.push(`(lower(cu.court) LIKE ?
              OR lower(cu.case_number) LIKE ?
              OR lower(COALESCE(cu.defendant_name, '')) LIKE ?
              OR lower(COALESCE(cu.category, '')) LIKE ?)`);
    parameters.push(pattern, pattern, pattern, pattern);
  }

  const category = options.category;
  if (category !== undefined && category !== '') {
    if (category === NONE_CATEGORY) {
      clauses.push('cu.category IS NULL');
    } else {
      clauses.push('cu.category = ?');
      parameters.push(category);
    }
  }

  return {
    where: clauses.length === 0 ? '' : `WHERE ${clauses.join(' AND ')}`,
    parameters,
  };
}

/**
 * Collapse whitespace and cut at a word boundary. The returned string is at
 * most `maxLength` characters including the ellipsis.
 */
export function buildNarrationPreview(
  narration: string | null | undefined,
  maxLength = 160,
): string | null {
  if (narration === null || narration === undefined) {
    return null;
  }
  const collapsed = narration.replace(/\s+/g, ' ').trim();
  if (collapsed === '') {
    return null;
  }
  if (collapsed.length <= maxLength) {
    return collapsed;
  }

  const budget = Math.max(1, maxLength - 1);
  let slice = collapsed.slice(0, budget);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > 0) {
    slice = slice.slice(0, lastSpace);
  }
  slice = slice.replace(/[\s,;:.!?–—-]+$/u, '').trim();
  return `${slice}…`;
}

/** Paginated summaries for the case-base list. Facts stay in `getCaseUnit`. */
export function listCaseUnitSummaries(
  db: DatabaseSync,
  options: CaseUnitListOptions = {},
): CaseUnitSummary[] {
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 25), 1), 200);
  const offset = Math.max(Math.trunc(options.offset ?? 0), 0);
  const filter = buildCaseFilter(options);

  const rows = db
    .prepare(
      `SELECT cu.id,
              cu.case_group_id,
              cg.label AS case_group_label,
              cu.court,
              cu.case_number,
              cu.defendant_name,
              cu.category,
              cu.narration,
              cu.actual_sentence_days,
              cu.created_at,
              cu.updated_at,
              (SELECT COUNT(*) FROM case_article a WHERE a.case_unit_id = cu.id)
                AS article_count,
              (SELECT COUNT(*) FROM case_unit_source s WHERE s.case_unit_id = cu.id)
                AS source_count
         FROM case_unit cu
         LEFT JOIN case_group cg ON cg.id = cu.case_group_id
         ${filter.where}
        ORDER BY cu.created_at DESC, cu.id
        LIMIT ? OFFSET ?`,
    )
    .all(...filter.parameters, limit, offset) as unknown as Array<{
    id: string;
    case_group_id: string;
    case_group_label: string | null;
    court: string;
    case_number: string;
    defendant_name: string | null;
    category: string | null;
    narration: string;
    actual_sentence_days: number | null;
    article_count: number;
    source_count: number;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    caseGroupId: row.case_group_id,
    caseGroupLabel: row.case_group_label,
    court: row.court,
    caseNumber: row.case_number,
    defendantName: row.defendant_name,
    category: row.category,
    narrationPreview: buildNarrationPreview(row.narration),
    actualSentenceDays: row.actual_sentence_days,
    articleCount: row.article_count,
    sourceCount: row.source_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/** Count the same predicate as `listCaseUnitSummaries`. */
export function countCaseUnitSummaries(
  db: DatabaseSync,
  options: Pick<CaseUnitListOptions, 'query' | 'category'> = {},
): number {
  const filter = buildCaseFilter(options);
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM case_unit cu ${filter.where}`)
    .get(...filter.parameters) as { count: number };
  return row.count;
}

export interface VocabularyCount {
  value: string;
  caseCount: number;
}

export interface CaseBaseVocabulary {
  generation: number;
  categories: VocabularyCount[];
  uncategorizedCount: number;
  attributes: {
    education: VocabularyCount[];
    occupation: VocabularyCount[];
  };
  limit: number;
}

/**
 * Read the whole vocabulary inside one transaction so counts and generation
 * describe the same case-base snapshot.
 */
export function getCaseBaseVocabulary(
  db: DatabaseSync,
  limit = 20,
): CaseBaseVocabulary {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);

  db.exec('SAVEPOINT vocabulary_read');
  try {
    const generation = getCaseBaseGeneration(db).generation;

    const categories = db
      .prepare(
        `SELECT category AS value, COUNT(*) AS case_count
           FROM case_unit
          WHERE category IS NOT NULL
          GROUP BY category
          ORDER BY case_count DESC, value ASC`,
      )
      .all() as unknown as Array<{ value: string; case_count: number }>;

    const uncategorized = db
      .prepare(
        `SELECT COUNT(*) AS count FROM case_unit WHERE category IS NULL`,
      )
      .get() as { count: number };

    const attributeCounts = (attributeKey: string): VocabularyCount[] => {
      const rows = db
        .prepare(
          `SELECT lower(value_text) AS value, COUNT(*) AS case_count
             FROM case_fact_attribute
            WHERE attribute_key = ? AND value_text IS NOT NULL
            GROUP BY lower(value_text)
            ORDER BY case_count DESC, value ASC
            LIMIT ?`,
        )
        .all(attributeKey, safeLimit) as unknown as Array<{
        value: string;
        case_count: number;
      }>;
      return rows.map((row) => ({ value: row.value, caseCount: row.case_count }));
    };

    const vocabulary: CaseBaseVocabulary = {
      generation,
      categories: categories.map((row) => ({
        value: row.value,
        caseCount: row.case_count,
      })),
      uncategorizedCount: uncategorized.count,
      attributes: {
        education: attributeCounts('education'),
        occupation: attributeCounts('occupation'),
      },
      limit: safeLimit,
    };

    db.exec('RELEASE vocabulary_read');
    return vocabulary;
  } catch (error) {
    db.exec('ROLLBACK TO vocabulary_read');
    db.exec('RELEASE vocabulary_read');
    throw error;
  }
}

/** Provenance of one case unit, including every known source alias. */
export function listCaseUnitSources(
  db: DatabaseSync,
  caseUnitId: string,
): CaseUnitSourceSummary[] {
  const id = requireText(caseUnitId, 'caseUnitId');
  const rows = db
    .prepare(
      `SELECT sd.id AS source_document_id,
              sd.content_hash,
              sd.snapshot_path,
              sd.source_url,
              cus.narration_location,
              cus.outcome_location
         FROM case_unit_source cus
         JOIN source_document sd ON sd.id = cus.source_document_id
        WHERE cus.case_unit_id = ?
        ORDER BY sd.id`,
    )
    .all(id) as unknown as Array<{
    source_document_id: string;
    content_hash: string;
    snapshot_path: string;
    source_url: string | null;
    narration_location: string | null;
    outcome_location: string | null;
  }>;

  const aliases = db
    .prepare(
      `SELECT sa.source_document_id, sa.alias_value
         FROM source_alias sa
         JOIN case_unit_source cus ON cus.source_document_id = sa.source_document_id
        WHERE cus.case_unit_id = ?
        ORDER BY sa.source_document_id, sa.alias_type, sa.alias_value`,
    )
    .all(id) as unknown as Array<{ source_document_id: string; alias_value: string }>;

  const aliasesByDocument = new Map<string, string[]>();
  for (const alias of aliases) {
    const values = aliasesByDocument.get(alias.source_document_id);
    if (values === undefined) {
      aliasesByDocument.set(alias.source_document_id, [alias.alias_value]);
    } else {
      values.push(alias.alias_value);
    }
  }

  return rows.map((row) => ({
    sourceDocumentId: row.source_document_id,
    contentHash: row.content_hash,
    snapshotPath: row.snapshot_path,
    sourceUrl: row.source_url,
    narrationLocation: row.narration_location,
    outcomeLocation: row.outcome_location,
    aliases: aliasesByDocument.get(row.source_document_id) ?? [],
  }));
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

function countSourceDocuments(db: DatabaseSync): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM source_document').get() as {
    count: number;
  };
  return row.count;
}

function countSourceAliases(db: DatabaseSync): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM source_alias').get() as {
    count: number;
  };
  return row.count;
}

export function getDatabaseStatus(db: DatabaseSync): DatabaseStatus {
  return {
    schemaVersion: getSchemaVersion(db),
    caseUnits: countCaseUnits(db),
    caseGroups: countCaseGroups(db),
    sourceDocuments: countSourceDocuments(db),
    sourceAliases: countSourceAliases(db),
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
