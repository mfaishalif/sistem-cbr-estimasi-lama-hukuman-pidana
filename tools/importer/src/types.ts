import type { CaseArticleDraft, FactValue } from '@cbr/core';

export interface SnapshotFileEntry {
  path: string;
  sha256: string;
  bytes: number;
}

export interface SnapshotManifest {
  schemaVersion: number;
  source: {
    repository: string;
    commit: string;
    datasetTree: string;
    archiveUrl: string;
    archiveSha256: string;
    archiveBytes: number;
    downloadedAt: string;
  };
  extraction: {
    datasetPath: string;
    fileCount: number;
    totalBytes: number;
    files: SnapshotFileEntry[];
  };
}

export type SkipCode =
  | 'invalid_xml'
  | 'unreadable_file'
  | 'document_metadata_missing'
  | 'not_general_criminal_case'
  | 'coverage_doubtful'
  | 'special_law_charge'
  | 'case_number_missing'
  | 'court_missing'
  | 'defendant_identity_missing'
  | 'multiple_defendants'
  | 'outcome_not_positive'
  | 'outcome_conflict'
  | 'narrative_not_separable'
  | 'narrative_contains_outcome'
  | 'narrative_too_short'
  | 'identity_outcome_conflict';

export interface SkipRecord {
  code: SkipCode;
  sourcePath: string;
}

export interface ExtractedCase {
  sourcePaths: string[];
  sourceUrl: string | null;
  court: string;
  caseNumber: string;
  courtNormalized: string;
  caseNumberNormalized: string;
  defendantName: string;
  defendantNormalized: string;
  narration: string;
  narrationLocation: string;
  category: string | null;
  categorySourceLocation: string | null;
  actualSentenceDays: number;
  outcomeLocation: string;
  outcomeSourceValue: string;
  outcomeSourceUnit: string;
  outcomeKind: 'metadata' | 'metadata-and-verdict';
  articles: CaseArticleDraft[];
  attributes: Record<string, FactValue>;
  groupKey: string;
  unitKey: string;
  relatedCaseKeys: string[];
}

export interface ImportOptions {
  sourceDir: string;
  databasePath: string;
  reportPath?: string;
  replace?: boolean;
  limit?: number;
}

export interface ImportReport {
  status: 'ok';
  database: string;
  mode: 'replace' | 'append';
  databaseStatus: {
    schemaVersion: string | null;
    caseUnits: number;
    caseGroups: number;
    generation: number;
  };
  source: {
    root: string;
    manifestPath: string | null;
    commit: string | null;
    datasetTree: string | null;
    archiveSha256: string | null;
    filesFound: number;
    filesRead: number;
    bytesRead: number;
    manifestVerified: boolean;
  };
  counts: {
    documentsParsed: number;
    documentsSkipped: number;
    casesAccepted: number;
    casesSkipped: number;
    caseGroups: number;
    sourceDocuments: number;
    sourceAliases: number;
    copiesMerged: number;
    relatedGroupsMerged: number;
    conflicts: number;
  };
  skipReasons: Array<{ code: SkipCode; count: number; examples: string[] }>;
  categories: Record<string, number>;
  categoryUnknown: number;
  attributes: Record<
    string,
    {
      /** Units whose value survives normalization and is written to the case base. */
      present: number;
      total: number;
      /** Distinct raw values before normalization, over deduplicated case units. */
      uniqueValuesBefore: number;
      /** Distinct canonical values after normalization, over deduplicated case units. */
      uniqueValuesAfter: number;
      /** Units whose raw value normalized away and was therefore not written. */
      discarded: number;
    }
  >;
  outcomes: {
    metadataOnly: number;
    metadataAndVerdict: number;
  };
  grouping: {
    largestGroup: number;
    relatedLinks: number;
    relatedGroupsMerged: number;
  };
  timing: {
    discoveryMs: number;
    parseMs: number;
    extractionMs: number;
    writeMs: number;
    totalMs: number;
  };
}
