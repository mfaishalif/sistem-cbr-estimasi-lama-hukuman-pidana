import type { DatabaseSync } from 'node:sqlite';

export interface Migration {
  id: string;
  name: string;
  sql: string;
}

const generationTables = ['case_unit', 'case_article', 'case_fact_attribute', 'app_config'] as const;
const triggerEvents = ['INSERT', 'UPDATE', 'DELETE'] as const;

/**
 * Any change that can affect similarity inputs advances the case base
 * generation. Derived indexes must match the current generation before use.
 * Provenance-only tables (groups, sources, source links) are excluded because
 * they do not change retrieval inputs.
 */
function generationTriggers(): string {
  return generationTables
    .flatMap((table) =>
      triggerEvents.map(
        (event) => `CREATE TRIGGER trg_generation_${table}_${event.toLowerCase()}
AFTER ${event} ON ${table}
BEGIN
  UPDATE case_base_generation
    SET generation = generation + 1,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = 1;
END;`,
      ),
    )
    .join('\n\n');
}

const initialSchema = `
CREATE TABLE case_group (
  id TEXT PRIMARY KEY,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Canonical source document. Byte-identical copies share one row; their
-- paths/IDs remain traceable as source_alias rows. Documents whose full
-- content matches after format normalization also share one canonical row.
CREATE TABLE source_document (
  id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL CHECK (length(trim(content_hash)) > 0),
  normalized_content_hash TEXT,
  snapshot_path TEXT NOT NULL CHECK (length(trim(snapshot_path)) > 0),
  source_url TEXT,
  retrieved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (content_hash)
);

CREATE UNIQUE INDEX idx_source_document_normalized_hash
  ON source_document (normalized_content_hash);

CREATE TABLE source_alias (
  id TEXT PRIMARY KEY,
  source_document_id TEXT NOT NULL REFERENCES source_document (id) ON DELETE CASCADE,
  alias_type TEXT NOT NULL CHECK (alias_type IN ('path', 'xml_id', 'url', 'other')),
  alias_value TEXT NOT NULL CHECK (length(trim(alias_value)) > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (alias_type, alias_value)
);

CREATE INDEX idx_source_alias_document ON source_alias (source_document_id);

-- One defendant in one case. The internal ID is stable and independent from
-- document identities. Estimate columns intentionally do not exist here:
-- actual_sentence_days is the verdict outcome, never a prediction.
-- Normalized identity columns are stored for matching; raw values remain for
-- display and traceability. Duplicate/conflicting units are not silently
-- merged by a unique constraint: import validation resolves them first.
CREATE TABLE case_unit (
  id TEXT PRIMARY KEY,
  case_group_id TEXT NOT NULL REFERENCES case_group (id) ON DELETE RESTRICT,
  court TEXT NOT NULL CHECK (length(trim(court)) > 0),
  case_number TEXT NOT NULL CHECK (length(trim(case_number)) > 0),
  court_normalized TEXT NOT NULL CHECK (length(trim(court_normalized)) > 0),
  case_number_normalized TEXT NOT NULL CHECK (length(trim(case_number_normalized)) > 0),
  defendant_name TEXT,
  narration TEXT NOT NULL CHECK (length(trim(narration)) > 0),
  category TEXT,
  category_source_location TEXT,
  actual_sentence_days INTEGER
    CHECK (actual_sentence_days IS NULL OR actual_sentence_days >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_case_unit_group ON case_unit (case_group_id);
CREATE INDEX idx_case_unit_category ON case_unit (category);
CREATE INDEX idx_case_unit_identity
  ON case_unit (court_normalized, case_number_normalized);

-- Which source documents and locations support a case unit.
CREATE TABLE case_unit_source (
  case_unit_id TEXT NOT NULL REFERENCES case_unit (id) ON DELETE CASCADE,
  source_document_id TEXT NOT NULL REFERENCES source_document (id) ON DELETE RESTRICT,
  narration_location TEXT,
  outcome_location TEXT,
  notes TEXT,
  PRIMARY KEY (case_unit_id, source_document_id)
);

CREATE INDEX idx_case_unit_source_document ON case_unit_source (source_document_id);

-- Indictment articles. Alternative and subsidiary arrangements are preserved;
-- they are not rewritten to match the proven offence.
CREATE TABLE case_article (
  id TEXT PRIMARY KEY,
  case_unit_id TEXT NOT NULL REFERENCES case_unit (id) ON DELETE CASCADE,
  law TEXT NOT NULL CHECK (length(trim(law)) > 0),
  article TEXT NOT NULL CHECK (length(trim(article)) > 0),
  paragraph TEXT,
  arrangement TEXT NOT NULL DEFAULT 'primary'
    CHECK (arrangement IN ('primary', 'alternative', 'subsidiary')),
  normalized_reference TEXT NOT NULL CHECK (length(trim(normalized_reference)) > 0),
  raw_text TEXT,
  source_location TEXT,
  UNIQUE (case_unit_id, normalized_reference, arrangement)
);

CREATE INDEX idx_case_article_unit ON case_article (case_unit_id);

-- Optional structured facts. No row means "unknown". An explicit negative
-- statement (for example prior_conviction 'no') is a row, so unknown is never
-- mistaken for zero, none, or "no".
CREATE TABLE case_fact_attribute (
  case_unit_id TEXT NOT NULL REFERENCES case_unit (id) ON DELETE CASCADE,
  attribute_key TEXT NOT NULL CHECK (length(trim(attribute_key)) > 0),
  value_type TEXT NOT NULL CHECK (value_type IN ('text', 'number', 'boolean', 'enum', 'set')),
  value_text TEXT,
  value_number REAL,
  value_unit TEXT,
  source_location TEXT,
  PRIMARY KEY (case_unit_id, attribute_key),
  CHECK (
    (value_type = 'number' AND value_number IS NOT NULL)
    OR (value_type IN ('text', 'enum', 'set') AND value_text IS NOT NULL)
    OR (value_type = 'boolean' AND value_number IN (0, 1))
  )
);

CREATE INDEX idx_case_fact_attribute_key ON case_fact_attribute (attribute_key);

-- Application configuration. Values are JSON. Changes advance the derived
-- index generation because configuration can affect preprocessing/indexes.
CREATE TABLE app_config (
  key TEXT PRIMARY KEY CHECK (length(trim(key)) > 0),
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Monotonic generation of the case base and its configuration. Index caches
-- must match this generation before they may be used. This is cache
-- bookkeeping, not case version history.
CREATE TABLE case_base_generation (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  generation INTEGER NOT NULL DEFAULT 0 CHECK (generation >= 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO case_base_generation (id, generation) VALUES (1, 0);

${generationTriggers()}
`;

/**
 * Import provenance for the outcome. `actual_sentence_days` stays the single
 * normalized target, while the raw duration expression and the kind of source
 * that supported it remain traceable. These columns are provenance only and
 * therefore do not advance the case base generation.
 */
const importOutcomeProvenance = `
ALTER TABLE case_unit_source ADD COLUMN source_outcome_value TEXT;
ALTER TABLE case_unit_source ADD COLUMN source_outcome_unit TEXT;
ALTER TABLE case_unit_source ADD COLUMN source_outcome_kind TEXT
  CHECK (
    source_outcome_kind IS NULL
    OR source_outcome_kind IN ('metadata', 'metadata-and-verdict')
  );
`;

export const migrations: Migration[] = [
  {
    id: '001',
    name: 'initial-case-base',
    sql: initialSchema,
  },
  {
    id: '002',
    name: 'import-outcome-provenance',
    sql: importOutcomeProvenance,
  },
];

export interface MigrationResult {
  applied: string[];
  schemaVersion: string | null;
}

/** Apply pending migrations in order. Safe to run repeatedly. */
export function runMigrations(
  db: DatabaseSync,
  pendingMigrations: Migration[] = migrations,
): MigrationResult {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const appliedRows = db.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: string }>;
  const applied = new Set(appliedRows.map((row) => row.id));
  const newlyApplied: string[] = [];

  for (const migration of pendingMigrations) {
    if (applied.has(migration.id)) {
      continue;
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (id, name) VALUES (?, ?)').run(
        migration.id,
        migration.name,
      );
      db.exec('COMMIT');
      newlyApplied.push(migration.id);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  return { applied: newlyApplied, schemaVersion: getSchemaVersion(db) };
}

export function getSchemaVersion(db: DatabaseSync): string | null {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    .get();

  if (table === undefined) {
    return null;
  }

  const row = db
    .prepare('SELECT id FROM schema_migrations ORDER BY id DESC LIMIT 1')
    .get() as { id: string } | undefined;

  return row?.id ?? null;
}
