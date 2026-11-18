/**
 * SQLite adapter for the CBR engine.
 *
 * The adapter exposes one consistent snapshot per build. The engine itself has
 * no SQLite dependency; the API, import tool, and evaluation CLI can all supply
 * the same snapshot contract.
 */

import type { DatabaseSync } from 'node:sqlite';
import {
  CaseBaseChangedDuringReadError,
  resolveRetrievalConfig,
} from '@cbr/core';
import type {
  CaseBaseCase,
  CaseBaseSnapshot,
  CaseBaseSnapshotSource,
  CaseSourceReference,
  RetrievalConfig,
} from '@cbr/core';
import {
  getCaseBaseGeneration,
  getCaseUnit,
  getConfig,
  setConfig,
} from './repositories';

export const RETRIEVAL_CONFIG_KEY = 'cbr.retrieval_config';

interface SourceRow {
  case_unit_id: string;
  narration_location: string | null;
  outcome_location: string | null;
  source_document_id: string;
  content_hash: string;
  snapshot_path: string;
  source_url: string | null;
}

interface AliasRow {
  source_document_id: string;
  alias_value: string;
}

/**
 * Read the whole case base and its source provenance. The generation is read
 * before and after the read; a change in between rejects the snapshot so the
 * index manager can retry instead of publishing mixed data.
 */
export function loadCaseBaseSnapshot(db: DatabaseSync): CaseBaseSnapshot {
  const before = getCaseBaseGeneration(db).generation;

  const rows = db
    .prepare('SELECT id FROM case_unit ORDER BY id')
    .all() as Array<{ id: string }>;
  const cases: CaseBaseCase[] = [];
  for (const row of rows) {
    const unit = getCaseUnit(db, row.id);
    if (unit !== null) {
      cases.push(unit);
    }
  }

  const sourceRows = db
    .prepare(
      `SELECT cus.case_unit_id,
              cus.narration_location,
              cus.outcome_location,
              sd.id AS source_document_id,
              sd.content_hash,
              sd.snapshot_path,
              sd.source_url
         FROM case_unit_source cus
         JOIN source_document sd ON sd.id = cus.source_document_id
        ORDER BY cus.case_unit_id, sd.id`,
    )
    .all() as unknown as SourceRow[];

  const aliasRows = db
    .prepare(
      `SELECT source_document_id, alias_value
         FROM source_alias
        ORDER BY source_document_id, alias_type, alias_value`,
    )
    .all() as unknown as AliasRow[];

  const aliasesByDocument = new Map<string, string[]>();
  for (const alias of aliasRows) {
    const values = aliasesByDocument.get(alias.source_document_id);
    if (values === undefined) {
      aliasesByDocument.set(alias.source_document_id, [alias.alias_value]);
    } else {
      values.push(alias.alias_value);
    }
  }

  const sourcesByCase = new Map<string, CaseSourceReference[]>();
  for (const source of sourceRows) {
    const reference: CaseSourceReference = {
      sourceDocumentId: source.source_document_id,
      snapshotPath: source.snapshot_path,
      contentHash: source.content_hash,
      sourceUrl: source.source_url,
      narrationLocation: source.narration_location,
      outcomeLocation: source.outcome_location,
      aliases: aliasesByDocument.get(source.source_document_id) ?? [],
    };
    const values = sourcesByCase.get(source.case_unit_id);
    if (values === undefined) {
      sourcesByCase.set(source.case_unit_id, [reference]);
    } else {
      values.push(reference);
    }
  }

  for (const candidate of cases) {
    candidate.sources = sourcesByCase.get(candidate.id) ?? [];
  }

  const after = getCaseBaseGeneration(db).generation;
  if (before !== after) {
    throw new CaseBaseChangedDuringReadError();
  }

  return { generation: before, cases };
}

/** SQLite-backed snapshot source used by the API and evaluation CLI. */
export class SqliteCaseBaseSource implements CaseBaseSnapshotSource {
  constructor(private readonly db: DatabaseSync) {}

  getGeneration(): number {
    return getCaseBaseGeneration(this.db).generation;
  }

  loadSnapshot(): CaseBaseSnapshot {
    return loadCaseBaseSnapshot(this.db);
  }

  /** Persisted config; a manager without an explicit config refreshes it per rebuild. */
  loadConfig(): RetrievalConfig {
    return loadRetrievalConfig(this.db);
  }
}

/**
 * Load the configured retrieval parameters. The defaults are placeholders
 * until the evaluation ticket locks final values; callers may pass their own
 * config directly to the index manager instead.
 */
export function loadRetrievalConfig(db: DatabaseSync): RetrievalConfig {
  const entry = getConfig(db, RETRIEVAL_CONFIG_KEY);
  if (entry === null) {
    return resolveRetrievalConfig();
  }
  return resolveRetrievalConfig(entry.value as Parameters<typeof resolveRetrievalConfig>[0]);
}

/** Persist retrieval parameters. The app_config trigger advances the generation. */
export function saveRetrievalConfig(db: DatabaseSync, config: RetrievalConfig): void {
  setConfig(db, RETRIEVAL_CONFIG_KEY, config);
}
