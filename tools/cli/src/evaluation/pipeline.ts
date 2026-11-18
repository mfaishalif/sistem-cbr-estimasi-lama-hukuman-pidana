/**
 * Evaluation pipeline for the `evaluate` command.
 *
 * The three stages are deliberately separate:
 *
 * 1. `prepare` imports a pinned snapshot into the evaluation workspace, builds
 *    the group-aware split, and records the snapshot identity, seed, members,
 *    groups, and fingerprints.
 * 2. `validate` tunes the approved candidate grid on the validation split only
 *    and writes a locked configuration. Test data is never read.
 * 3. `test` refuses to run unless the lock matches the current manifest, then
 *    reports the locked model and the approved component variants.
 *
 * The application SQLite volume is never touched: the caller passes the
 * evaluation workspace, and this module only opens the database inside it.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  buildRetrievalIndex,
  estimateWithIndex,
  retrievalConfigFingerprint,
  stableHash,
  type CaseBaseCase,
  type EstimateResult,
  type RetrievalConfig,
  type RetrievalIndex,
} from '@cbr/core';
import { closeDatabase, loadCaseBaseSnapshot, openDatabase } from '@cbr/data';
import { runImport, type ImportReport } from '@cbr/importer';
import { buildMedianBaseline, type MedianBaseline } from './baseline';
import {
  buildEvaluationCandidates,
  buildNarrationOnlyConfig,
  EVALUATION_COVERAGE_TARGET,
  EVALUATION_GRID_PROTOCOL,
  EVALUATION_MAX_REFERENCES,
  EVALUATION_MIN_ATTRIBUTE_COVERAGES,
  EVALUATION_MIN_CANDIDATE_ESTIMATES,
  EVALUATION_MIN_REFERENCES,
  EVALUATION_MIN_SCORES,
  EVALUATION_MIN_VALIDATION_GROUPS,
  EVALUATION_MIN_VALIDATION_UNITS,
  EVALUATION_PREPROCESSING,
  EVALUATION_PROPORTIONS,
  EVALUATION_SEED,
  EVALUATION_WEIGHTS,
  indexStructureKey,
  type EvaluationCandidate,
} from './grid';
import {
  evaluatePredictions,
  type EvaluationPrediction,
  type EvaluationReport,
} from './metrics';
import {
  selectValidationCandidate,
  type CandidateEvaluation,
  type SelectionRule,
} from './selection';
import {
  buildSplitManifest,
  SPLIT_NAMES,
  type SplitManifest,
  type SplitName,
  type SplitProportions,
  type SplitSummary,
} from './split';

export const EVALUATION_MANIFEST_FILE = 'evaluation-manifest.json';
export const EVALUATION_SPLIT_FILE = 'split-manifest.json';
export const EVALUATION_VALIDATION_FILE = 'validation-report.json';
export const EVALUATION_LOCK_FILE = 'locked-config.json';
export const EVALUATION_TEST_FILE = 'test-report.json';
export const EVALUATION_IMPORT_FILE = 'import-report.json';
export const EVALUATION_VALIDATION_UNITS_FILE = 'validation-per-unit.jsonl';
export const EVALUATION_TEST_UNITS_FILE = 'test-per-unit.jsonl';

export type EvaluationStage = 'prepare' | 'validate' | 'test' | 'all';

export type EvaluationErrorCode =
  | 'INPUT_TIDAK_VALID'
  | 'DATA_TIDAK_CUKUP'
  | 'MANIFEST_TIDAK_ADA'
  | 'MANIFEST_TIDAK_COCOK'
  | 'KONFIGURASI_TERKUNCI_TIDAK_ADA'
  | 'KONFIGURASI_TERKUNCI_TIDAK_COCOK';

const EXIT_CODES: Record<EvaluationErrorCode, number> = {
  INPUT_TIDAK_VALID: 2,
  DATA_TIDAK_CUKUP: 3,
  MANIFEST_TIDAK_ADA: 4,
  MANIFEST_TIDAK_COCOK: 4,
  KONFIGURASI_TERKUNCI_TIDAK_ADA: 4,
  KONFIGURASI_TERKUNCI_TIDAK_COCOK: 4,
};

export class EvaluationError extends Error {
  readonly exitCode: number;

  constructor(
    readonly code: EvaluationErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EvaluationError';
    this.exitCode = EXIT_CODES[code];
  }
}

export interface EvaluationOptions {
  workspace: string;
  artifacts: string;
  stage?: EvaluationStage;
  sourceDir?: string;
  seed?: string;
  proportions?: SplitProportions;
  limit?: number;
  minValidationUnits?: number;
  minValidationGroups?: number;
  minCandidateEstimates?: number;
  now?: () => number;
}

export interface EvaluationStageResult {
  status: 'prepared' | 'validated' | 'postponed' | 'tested';
  exitCode: number;
  [key: string]: unknown;
}

export interface EvaluationSnapshotIdentity {
  root: string;
  manifestPath: string | null;
  commit: string | null;
  datasetTree: string | null;
  archiveSha256: string | null;
  manifestVerified: boolean;
  filesFound: number;
  filesRead: number;
  bytesRead: number;
}

export interface SplitCategoryCounts {
  categories: Record<string, number>;
  categoryUnknown: number;
  eligiblePositiveOutcome: number;
}

export interface EvaluationProtocol {
  gridProtocol: number;
  preprocessing: typeof EVALUATION_PREPROCESSING;
  coverageTarget: number;
  selectionRule: string;
  enumerationOrder: readonly string[];
  weights: typeof EVALUATION_WEIGHTS;
  maxReferences: typeof EVALUATION_MAX_REFERENCES;
  minReferences: typeof EVALUATION_MIN_REFERENCES;
  minScores: typeof EVALUATION_MIN_SCORES;
  minAttributeCoverages: typeof EVALUATION_MIN_ATTRIBUTE_COVERAGES;
}

export const EVALUATION_PROTOCOL: EvaluationProtocol = {
  gridProtocol: EVALUATION_GRID_PROTOCOL,
  preprocessing: EVALUATION_PREPROCESSING,
  coverageTarget: EVALUATION_COVERAGE_TARGET,
  selectionRule:
    'lowest MAE among candidates at or above the coverage target, then highest coverage, then grid order; fallback to highest coverage, then lowest MAE, then grid order',
  enumerationOrder: [
    'component weights',
    'k (max references)',
    'minimum references',
    'minimum score',
    'minimum attribute coverage',
  ],
  weights: EVALUATION_WEIGHTS,
  maxReferences: EVALUATION_MAX_REFERENCES,
  minReferences: EVALUATION_MIN_REFERENCES,
  minScores: EVALUATION_MIN_SCORES,
  minAttributeCoverages: EVALUATION_MIN_ATTRIBUTE_COVERAGES,
};

export interface EvaluationManifest {
  schemaVersion: 1;
  createdAt: string;
  stage: 'prepare';
  evaluationDatabase: string;
  artifacts: string;
  importReport: string;
  source: EvaluationSnapshotIdentity;
  seed: string;
  proportions: SplitProportions;
  protocol: EvaluationProtocol;
  counts: {
    units: number;
    groups: number;
    eligiblePositiveOutcome: number;
  };
  perSplit: Record<SplitName, SplitSummary & SplitCategoryCounts>;
  checks: {
    everyUnitAssignedOnce: boolean;
    groupsDisjoint: boolean;
    emptySplits: SplitName[];
  };
  fingerprints: {
    caseBase: string;
    split: string;
    manifest: string;
  };
  notes: string[];
}

export interface LockedEvaluationConfig {
  schemaVersion: 1;
  lockedAt: string;
  manifestFingerprint: string;
  snapshot: EvaluationSnapshotIdentity;
  seed: string;
  proportions: SplitProportions;
  selected: {
    id: string;
    gridIndex: number;
    rule: SelectionRule;
    targetMet: boolean;
  };
  config: RetrievalConfig;
  configFingerprint: string;
  validationReport: string;
  evaluation: {
    coverageTarget: number;
    preprocessing: typeof EVALUATION_PREPROCESSING;
    gridProtocol: number;
    selectionRule: string;
    enumerationOrder: readonly string[];
  };
  notes: string[];
}

interface EvaluationState {
  workspace: string;
  artifacts: string;
  manifest: EvaluationManifest;
  split: SplitManifest;
  cases: readonly CaseBaseCase[];
  casesById: Map<string, CaseBaseCase>;
}

interface CandidateRun extends CandidateEvaluation {
  candidate: EvaluationCandidate;
  predictions: EvaluationPrediction[];
  details: UnitPredictionDetail[];
}

interface UnitPredictionDetail {
  unit: CaseBaseCase;
  prediction: EvaluationPrediction;
  result: EstimateResult;
}

interface DataThresholds {
  minValidationUnits: number;
  minValidationGroups: number;
  minCandidateEstimates: number;
}

function thresholdsFrom(options: EvaluationOptions): DataThresholds {
  return {
    minValidationUnits: options.minValidationUnits ?? EVALUATION_MIN_VALIDATION_UNITS,
    minValidationGroups: options.minValidationGroups ?? EVALUATION_MIN_VALIDATION_GROUPS,
    minCandidateEstimates:
      options.minCandidateEstimates ?? EVALUATION_MIN_CANDIDATE_ESTIMATES,
  };
}

function clock(options: EvaluationOptions): () => number {
  return options.now ?? Date.now;
}

function isoNow(options: EvaluationOptions): string {
  return new Date(clock(options)()).toISOString();
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson<T>(path: string, label: string, missingCode: EvaluationErrorCode): T {
  if (!existsSync(path)) {
    throw new EvaluationError(missingCode, `${label} tidak ditemukan: ${path}`, {
      path,
    });
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch (error) {
    throw new EvaluationError(
      missingCode,
      `${label} tidak dapat dibaca: ${path} (${error instanceof Error ? error.message : String(error)})`,
      { path },
    );
  }
}

function writeJsonLines(path: string, lines: readonly unknown[]): void {
  writeFileSync(
    path,
    lines.map((line) => JSON.stringify(line)).join('\n') + (lines.length === 0 ? '' : '\n'),
    'utf8',
  );
}

function sortedRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );
}

function categoryCounts(cases: readonly CaseBaseCase[]): SplitCategoryCounts {
  const counts = new Map<string, number>();
  let categoryUnknown = 0;
  let eligiblePositiveOutcome = 0;
  for (const unit of cases) {
    const category = unit.facts.category?.trim();
    if (category === undefined || category === '') {
      categoryUnknown += 1;
    } else {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    const outcome = unit.outcome.actualSentenceDays;
    if (typeof outcome === 'number' && Number.isFinite(outcome) && outcome > 0) {
      eligiblePositiveOutcome += 1;
    }
  }

  return {
    categories: sortedRecord(Object.fromEntries(counts.entries())),
    categoryUnknown,
    eligiblePositiveOutcome,
  };
}

function groupCount(cases: readonly CaseBaseCase[]): number {
  return new Set(cases.map((unit) => unit.caseGroupId)).size;
}

/** Data contents that must change the manifest when a snapshot changes. */
export function caseBaseFingerprint(cases: readonly CaseBaseCase[]): string {
  const normalized = [...cases]
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
    .map((unit) => ({
      id: unit.id,
      caseGroupId: unit.caseGroupId,
      category: unit.facts.category ?? null,
      narration: unit.facts.narration,
      actualSentenceDays: unit.outcome.actualSentenceDays,
      articles: (unit.facts.articles ?? [])
        .map(
          (article) =>
            article.normalizedReference ??
            [article.law, article.article, article.paragraph ?? '']
              .map((part) => part.trim().toLowerCase().replace(/\s+/g, ' '))
              .filter((part) => part !== '')
              .join('|'),
        )
        .sort(),
      attributes: unit.facts.attributes ?? {},
    }));
  return stableHash(normalized);
}

export function splitFingerprint(split: SplitManifest): string {
  return stableHash({
    seed: split.seed,
    proportions: split.requestedProportions,
    assignments: split.assignments,
  });
}

export function snapshotIdentityFingerprint(source: EvaluationSnapshotIdentity): string {
  return stableHash({
    commit: source.commit,
    datasetTree: source.datasetTree,
    archiveSha256: source.archiveSha256,
    manifestVerified: source.manifestVerified,
    filesFound: source.filesFound,
  });
}

export function evaluationManifestFingerprint(input: {
  source: EvaluationSnapshotIdentity;
  seed: string;
  proportions: SplitProportions;
  caseBaseFingerprint: string;
  splitFingerprint: string;
}): string {
  return stableHash({
    source: snapshotIdentityFingerprint(input.source),
    seed: input.seed,
    proportions: input.proportions,
    caseBase: input.caseBaseFingerprint,
    split: input.splitFingerprint,
  });
}

function snapshotIdentity(report: ImportReport): EvaluationSnapshotIdentity {
  return {
    root: report.source.root,
    manifestPath: report.source.manifestPath,
    commit: report.source.commit,
    datasetTree: report.source.datasetTree,
    archiveSha256: report.source.archiveSha256,
    manifestVerified: report.source.manifestVerified,
    filesFound: report.source.filesFound,
    filesRead: report.source.filesRead,
    bytesRead: report.source.bytesRead,
  };
}

function loadCases(databasePath: string): readonly CaseBaseCase[] {
  const db = openDatabase(databasePath);
  try {
    return loadCaseBaseSnapshot(db).cases;
  } finally {
    closeDatabase(db);
  }
}

function unitsForSplit(
  cases: readonly CaseBaseCase[],
  split: SplitManifest,
  name: SplitName,
): CaseBaseCase[] {
  const byId = new Map(cases.map((unit) => [unit.id, unit]));
  return split.units[name].map((unitId) => {
    const unit = byId.get(unitId);
    if (unit === undefined) {
      throw new EvaluationError(
        'MANIFEST_TIDAK_COCOK',
        `Split ${name} memuat unit yang tidak ada di snapshot: ${unitId}`,
      );
    }
    return unit;
  });
}

function casesBySplit(state: EvaluationState, split: SplitName): CaseBaseCase[] {
  return unitsForSplit(state.cases, state.split, split);
}

function assignmentChecks(
  cases: readonly CaseBaseCase[],
  split: SplitManifest,
): { everyUnitAssignedOnce: boolean; groupsDisjoint: boolean } {
  const caseById = new Map(cases.map((unit) => [unit.id, unit]));
  const seen = new Set<string>();
  let everyUnitAssignedOnce = split.assignments.length === cases.length;
  const groupsBySplit = new Map<string, Set<SplitName>>();

  for (const assignment of split.assignments) {
    if (seen.has(assignment.id)) {
      everyUnitAssignedOnce = false;
    }
    seen.add(assignment.id);
    const unit = caseById.get(assignment.id);
    if (unit === undefined || unit.caseGroupId !== assignment.caseGroupId) {
      everyUnitAssignedOnce = false;
    }

    const splits = groupsBySplit.get(assignment.caseGroupId) ?? new Set<SplitName>();
    splits.add(assignment.split);
    groupsBySplit.set(assignment.caseGroupId, splits);
  }

  const groupsDisjoint = [...groupsBySplit.values()].every(
    (splits) => splits.size === 1,
  );
  return { everyUnitAssignedOnce, groupsDisjoint };
}

function loadState(options: EvaluationOptions): EvaluationState {
  const workspace = options.workspace;
  const artifacts = options.artifacts;
  const manifest = readJson<EvaluationManifest>(
    join(artifacts, EVALUATION_MANIFEST_FILE),
    'Manifest evaluasi',
    'MANIFEST_TIDAK_ADA',
  );
  const split = readJson<SplitManifest>(
    join(artifacts, EVALUATION_SPLIT_FILE),
    'Manifest split',
    'MANIFEST_TIDAK_ADA',
  );

  if (
    manifest.schemaVersion !== 1 ||
    manifest.stage !== 'prepare' ||
    manifest.fingerprints === undefined ||
    !Array.isArray(split.assignments) ||
    split.units === undefined ||
    split.groups === undefined
  ) {
    throw new EvaluationError(
      'MANIFEST_TIDAK_COCOK',
      'Manifest evaluasi tidak dikenali atau berasal dari versi lama. Jalankan ulang tahap prepare.',
      { manifestPath: join(artifacts, EVALUATION_MANIFEST_FILE) },
    );
  }

  const evaluationDatabase = join(workspace, 'evaluation.db');
  if (!existsSync(evaluationDatabase)) {
    throw new EvaluationError(
      'MANIFEST_TIDAK_ADA',
      `Database evaluasi tidak ditemukan: ${evaluationDatabase}. Jalankan tahap prepare.`,
      { evaluationDatabase },
    );
  }

  const cases = loadCases(evaluationDatabase);
  const casesById = new Map(cases.map((unit) => [unit.id, unit]));

  const currentCaseBase = caseBaseFingerprint(cases);
  const currentSplit = splitFingerprint(split);
  const expected = evaluationManifestFingerprint({
    source: manifest.source,
    seed: manifest.seed,
    proportions: manifest.proportions,
    caseBaseFingerprint: currentCaseBase,
    splitFingerprint: currentSplit,
  });
  const checks = assignmentChecks(cases, split);

  if (
    expected !== manifest.fingerprints.manifest ||
    manifest.fingerprints.caseBase !== currentCaseBase ||
    manifest.fingerprints.split !== currentSplit ||
    !checks.everyUnitAssignedOnce ||
    !checks.groupsDisjoint
  ) {
    throw new EvaluationError(
      'MANIFEST_TIDAK_COCOK',
      'Manifest atau split tidak cocok dengan data evaluasi saat ini. Jalankan ulang tahap prepare sebelum validasi/test.',
      {
        expected,
        recorded: manifest.fingerprints.manifest,
        checks,
      },
    );
  }

  if (split.emptySplits.length > 0) {
    throw new EvaluationError(
      'DATA_TIDAK_CUKUP',
      `Split kosong: ${split.emptySplits.join(', ')}. Evaluasi dihentikan.`,
      { emptySplits: split.emptySplits },
    );
  }

  return { workspace, artifacts, manifest, split, cases, casesById };
}

function runImportSafely(options: EvaluationOptions, databasePath: string): ImportReport {
  const sourceDir = options.sourceDir;
  if (sourceDir === undefined || sourceDir.trim() === '') {
    throw new EvaluationError(
      'INPUT_TIDAK_VALID',
      'Tahap prepare memerlukan --source <direktori snapshot>.',
    );
  }
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    throw new EvaluationError(
      'INPUT_TIDAK_VALID',
      `Direktori sumber tidak ditemukan: ${sourceDir}`,
      { sourceDir },
    );
  }

  const reportPath = join(options.artifacts, EVALUATION_IMPORT_FILE);
  try {
    return runImport({
      sourceDir,
      databasePath,
      reportPath,
      limit: options.limit,
      replace: true,
    });
  } catch (error) {
    throw new EvaluationError(
      'INPUT_TIDAK_VALID',
      `Impor snapshot gagal: ${error instanceof Error ? error.message : String(error)}`,
      { sourceDir },
    );
  }
}

export function prepareEvaluation(options: EvaluationOptions): EvaluationStageResult {
  const startedAt = clock(options)();
  const workspace = options.workspace;
  const artifacts = options.artifacts;
  mkdirSync(workspace, { recursive: true });
  mkdirSync(artifacts, { recursive: true });

  const databasePath = join(workspace, 'evaluation.db');
  const importReport = runImportSafely(options, databasePath);
  if (importReport.counts.casesAccepted === 0) {
    throw new EvaluationError(
      'DATA_TIDAK_CUKUP',
      'Tidak ada unit kasus yang lolos impor; split dan evaluasi tidak dapat dibentuk.',
      { importReport: join(artifacts, EVALUATION_IMPORT_FILE) },
    );
  }

  const cases = loadCases(databasePath);
  if (cases.length === 0) {
    throw new EvaluationError(
      'DATA_TIDAK_CUKUP',
      'Database evaluasi tidak berisi unit kasus setelah impor.',
    );
  }

  const seed = options.seed ?? EVALUATION_SEED;
  const proportions = options.proportions ?? EVALUATION_PROPORTIONS;
  let split: SplitManifest;
  try {
    split = buildSplitManifest(cases, { seed, proportions });
  } catch (error) {
    throw new EvaluationError(
      'INPUT_TIDAK_VALID',
      `Split tidak dapat dibentuk: ${error instanceof Error ? error.message : String(error)}`,
      { seed, proportions },
    );
  }
  const checks = {
    ...assignmentChecks(cases, split),
    emptySplits: split.emptySplits,
  };

  if (split.emptySplits.length > 0 || !checks.everyUnitAssignedOnce || !checks.groupsDisjoint) {
    throw new EvaluationError(
      'DATA_TIDAK_CUKUP',
      `Split tidak layak: kosong=${split.emptySplits.join(',') || '-'}, setiap unit tepat sekali=${checks.everyUnitAssignedOnce}, kelompok tidak tumpang tindih=${checks.groupsDisjoint}.`,
      { split: split.summary, checks },
    );
  }

  const perSplit = Object.fromEntries(
    SPLIT_NAMES.map((name) => {
      const members = unitsForSplit(cases, split, name);
      return [name, { ...split.summary[name], ...categoryCounts(members) }];
    }),
  ) as EvaluationManifest['perSplit'];

  const caseFingerprint = caseBaseFingerprint(cases);
  const splitFingerprintValue = splitFingerprint(split);
  const source = snapshotIdentity(importReport);
  const manifestFingerprint = evaluationManifestFingerprint({
    source,
    seed,
    proportions,
    caseBaseFingerprint: caseFingerprint,
    splitFingerprint: splitFingerprintValue,
  });

  const manifest: EvaluationManifest = {
    schemaVersion: 1,
    createdAt: isoNow(options),
    stage: 'prepare',
    evaluationDatabase: databasePath,
    artifacts,
    importReport: join(artifacts, EVALUATION_IMPORT_FILE),
    source,
    seed,
    proportions,
    protocol: EVALUATION_PROTOCOL,
    counts: {
      units: cases.length,
      groups: groupCount(cases),
      eligiblePositiveOutcome: categoryCounts(cases).eligiblePositiveOutcome,
    },
    perSplit,
    checks,
    fingerprints: {
      caseBase: caseFingerprint,
      split: splitFingerprintValue,
      manifest: manifestFingerprint,
    },
    notes: [
      'Sumber mentah hanya dibaca untuk impor; database aplikasi tidak dipasang atau ditulis.',
      'Seluruh anggota satu kelompok perkara berada pada satu split.',
      'Test tidak dijalankan pada tahap ini; konfigurasi belum dipilih.',
    ],
  };

  const manifestPath = join(artifacts, EVALUATION_MANIFEST_FILE);
  const splitPath = join(artifacts, EVALUATION_SPLIT_FILE);
  writeJson(manifestPath, manifest);
  writeJson(splitPath, split);

  return {
    status: 'prepared',
    exitCode: 0,
    manifestPath,
    splitManifestPath: splitPath,
    importReportPath: manifest.importReport,
    evaluationDatabase: databasePath,
    seed,
    proportions,
    counts: manifest.counts,
    perSplit: Object.fromEntries(
      SPLIT_NAMES.map((name) => [
        name,
        {
          units: split.summary[name].unitCount,
          groups: split.summary[name].groupCount,
          eligiblePositiveOutcome: perSplit[name].eligiblePositiveOutcome,
        },
      ]),
    ),
    fingerprints: manifest.fingerprints,
    emptySplits: split.emptySplits,
    durationMs: performance.now() - startedAt,
  };
}

function indexForCandidate(
  trainingCases: readonly CaseBaseCase[],
  candidate: EvaluationCandidate,
  cache: Map<string, RetrievalIndex>,
): RetrievalIndex {
  const key = indexStructureKey(candidate.config);
  let base = cache.get(key);
  if (base === undefined) {
    base = buildRetrievalIndex(trainingCases, candidate.config, { generation: 0 });
    cache.set(key, base);
    return base;
  }
  if (base.configFingerprint === candidate.configFingerprint) {
    return base;
  }
  // Retrieval limits are not part of the index contents, so the fitted model
  // can be reused with the candidate's own config.
  return {
    ...base,
    config: candidate.config,
    configFingerprint: candidate.configFingerprint,
  };
}

function indexForConfig(
  trainingCases: readonly CaseBaseCase[],
  config: RetrievalConfig,
  cache: Map<string, RetrievalIndex>,
): RetrievalIndex {
  return indexForCandidate(
    trainingCases,
    {
      gridIndex: -1,
      id: 'runtime',
      narrativeWeight: config.components.narrativeWeight,
      articleWeight: config.components.articleWeight,
      attributeGroupWeight: config.components.attributeGroupWeight ?? 0,
      maxReferences: config.retrieval.maxReferences,
      minReferences: config.retrieval.minReferences,
      minScore: config.retrieval.minScore,
      minAttributeCoverage: config.retrieval.minAttributeCoverage,
      config,
      configFingerprint: retrievalConfigFingerprint(config),
    },
    cache,
  );
}

function toPrediction(unit: CaseBaseCase, result: EstimateResult): EvaluationPrediction {
  return {
    unitId: unit.id,
    category: unit.facts.category ?? null,
    actualSentenceDays: unit.outcome.actualSentenceDays,
    estimatedSentenceDays:
      result.status === 'estimated' ? result.estimate.rawDays : null,
    withheldReason: result.withholding?.code ?? null,
  };
}

export function predictSplit(
  index: RetrievalIndex,
  units: readonly CaseBaseCase[],
): UnitPredictionDetail[] {
  return units.map((unit) => {
    const result = estimateWithIndex(index, {
      facts: unit.facts,
      excludeCaseUnitIds: [unit.id],
    });
    return { unit, prediction: toPrediction(unit, result), result };
  });
}

/** Arithmetic mean of the selected reference outcomes (unweighted variant). */
export function unweightedReuse(result: EstimateResult): number | null {
  if (result.status !== 'estimated' || result.references.length === 0) {
    return null;
  }
  const total = result.references.reduce(
    (sum, reference) => sum + reference.actualSentenceDays,
    0,
  );
  return total / result.references.length;
}

function predictionFingerprint(
  details: readonly UnitPredictionDetail[],
  predictions: readonly EvaluationPrediction[],
): string {
  return stableHash(
    details.map((detail, index) => {
      const prediction = predictions[index];
      return {
        unitId: detail.unit.id,
        status: detail.result.status,
        estimate: prediction?.estimatedSentenceDays ?? null,
        withheld: prediction?.withheldReason ?? null,
        references: detail.result.references.map((reference) => ({
          caseUnitId: reference.caseUnitId,
          score: reference.score,
          actualSentenceDays: reference.actualSentenceDays,
        })),
      };
    }),
  );
}

function perUnitLine(
  stage: 'validation' | 'test',
  variant: string,
  detail: UnitPredictionDetail,
  estimate: number | null,
  withheldReason: string | null,
): Record<string, unknown> {
  return {
    stage,
    variant,
    unitId: detail.unit.id,
    caseGroupId: detail.unit.caseGroupId,
    category: detail.unit.facts.category ?? null,
    actualSentenceDays: detail.unit.outcome.actualSentenceDays,
    estimatedSentenceDays: estimate,
    withheldReason,
    references: detail.result.references.map((reference) => ({
      rank: reference.rank,
      caseUnitId: reference.caseUnitId,
      caseGroupId: reference.caseGroupId,
      score: reference.score,
      actualSentenceDays: reference.actualSentenceDays,
      weightShare: reference.reuse.weightShare,
      coverage: reference.comparison.coverage,
    })),
  };
}

function baselineFor(trainingCases: readonly CaseBaseCase[]): MedianBaseline {
  return buildMedianBaseline(
    trainingCases.map((unit) => ({
      id: unit.id,
      category: unit.facts.category ?? null,
      actualSentenceDays: unit.outcome.actualSentenceDays,
    })),
  );
}

function removeLockForManifest(artifacts: string, manifestFingerprint: string): void {
  const path = join(artifacts, EVALUATION_LOCK_FILE);
  if (!existsSync(path)) {
    return;
  }
  try {
    const lock = JSON.parse(readFileSync(path, 'utf8')) as Partial<LockedEvaluationConfig>;
    if (lock.manifestFingerprint === manifestFingerprint) {
      rmSync(path, { force: true });
    }
  } catch {
    rmSync(path, { force: true });
  }
}

function postponedValidation(
  options: EvaluationOptions,
  state: EvaluationState,
  thresholds: DataThresholds,
  reason: 'validasi-terlalu-kecil' | 'estimasi-terlalu-sedikit',
): EvaluationStageResult {
  const reportPath = join(state.artifacts, EVALUATION_VALIDATION_FILE);
  const validationUnits = state.split.summary.validation.unitCount;
  const validationGroups = state.split.summary.validation.groupCount;
  const report = {
    schemaVersion: 1,
    status: 'postponed',
    createdAt: isoNow(options),
    manifestFingerprint: state.manifest.fingerprints.manifest,
    snapshot: state.manifest.source,
    seed: state.manifest.seed,
    proportions: state.manifest.proportions,
    protocol: EVALUATION_PROTOCOL,
    thresholds,
    validation: { units: validationUnits, groups: validationGroups },
    reason,
    message:
      reason === 'validasi-terlalu-kecil'
        ? `Validasi berisi ${validationUnits} unit dan ${validationGroups} kelompok; minimum ${thresholds.minValidationUnits} unit dan ${thresholds.minValidationGroups} kelompok. Tuning ditunda dan test tetap terkunci.`
        : `Semua kandidat memberi estimasi untuk kurang dari ${thresholds.minCandidateEstimates} unit validasi. Tuning ditunda dan test tetap terkunci.`,
    locked: false,
    notes: [
      'Tidak ada konfigurasi yang dikunci pada run ini.',
      'Test tidak dijalankan; jangan memilih seed atau konfigurasi berdasarkan hasil test.',
    ],
  };
  writeJson(reportPath, report);
  removeLockForManifest(state.artifacts, state.manifest.fingerprints.manifest);

  return {
    status: 'postponed',
    exitCode: 3,
    reportPath,
    reason,
    message: report.message,
    validation: report.validation,
    thresholds,
    locked: false,
  };
}

export function validateEvaluation(options: EvaluationOptions): EvaluationStageResult {
  const state = loadState(options);
  const thresholds = thresholdsFrom(options);
  const trainingCases = casesBySplit(state, 'training');
  const validationCases = casesBySplit(state, 'validation');

  const validationGroups = state.split.summary.validation.groupCount;
  if (
    validationCases.length < thresholds.minValidationUnits ||
    validationGroups < thresholds.minValidationGroups
  ) {
    return postponedValidation(options, state, thresholds, 'validasi-terlalu-kecil');
  }

  const baseline = baselineFor(trainingCases);
  const candidates = buildEvaluationCandidates();
  const indexCache = new Map<string, RetrievalIndex>();
  const runs: CandidateRun[] = [];
  const perUnitLines: unknown[] = [];

  for (const candidate of candidates) {
    const index = indexForCandidate(trainingCases, candidate, indexCache);
    const details = predictSplit(index, validationCases);
    const predictions = details.map((detail) => detail.prediction);
    const report = evaluatePredictions(predictions, baseline);
    const estimatedUnitCount = predictions.filter(
      (prediction) => typeof prediction.estimatedSentenceDays === 'number',
    ).length;

    for (const detail of details) {
      perUnitLines.push(
        perUnitLine(
          'validation',
          candidate.id,
          detail,
          detail.prediction.estimatedSentenceDays ?? null,
          detail.prediction.withheldReason ?? null,
        ),
      );
    }

    runs.push({
      id: candidate.id,
      gridIndex: candidate.gridIndex,
      report,
      estimatedUnitCount,
      eligibleUnitCount: report.eligibleUnitCount,
      candidate,
      predictions,
      details,
    });
  }

  const maximumEstimates = runs.reduce(
    (maximum, run) => Math.max(maximum, run.estimatedUnitCount),
    0,
  );
  if (maximumEstimates < thresholds.minCandidateEstimates) {
    return postponedValidation(options, state, thresholds, 'estimasi-terlalu-sedikit');
  }

  const selection = selectValidationCandidate(runs, EVALUATION_COVERAGE_TARGET);
  const selectedRun = selection.selected as CandidateRun;
  const selected = selectedRun.candidate;

  const reportPath = join(state.artifacts, EVALUATION_VALIDATION_FILE);
  const report = {
    schemaVersion: 1,
    status: 'validated',
    createdAt: isoNow(options),
    manifestFingerprint: state.manifest.fingerprints.manifest,
    snapshot: state.manifest.source,
    seed: state.manifest.seed,
    proportions: state.manifest.proportions,
    protocol: EVALUATION_PROTOCOL,
    thresholds,
    dataset: {
      training: {
        units: state.split.summary.training.unitCount,
        groups: state.split.summary.training.groupCount,
        categories: state.manifest.perSplit.training.categories,
        categoryUnknown: state.manifest.perSplit.training.categoryUnknown,
        eligiblePositiveOutcome:
          state.manifest.perSplit.training.eligiblePositiveOutcome,
      },
      validation: {
        units: state.split.summary.validation.unitCount,
        groups: state.split.summary.validation.groupCount,
        categories: state.manifest.perSplit.validation.categories,
        categoryUnknown: state.manifest.perSplit.validation.categoryUnknown,
        eligiblePositiveOutcome:
          state.manifest.perSplit.validation.eligiblePositiveOutcome,
      },
      test: {
        units: state.split.summary.test.unitCount,
        groups: state.split.summary.test.groupCount,
        categories: state.manifest.perSplit.test.categories,
        categoryUnknown: state.manifest.perSplit.test.categoryUnknown,
        eligiblePositiveOutcome:
          state.manifest.perSplit.test.eligiblePositiveOutcome,
      },
    },
    baseline,
    grid: {
      coverageTarget: EVALUATION_COVERAGE_TARGET,
      targetMet: selection.targetMet,
      rule: selection.rule,
      candidates: runs.map((run) => ({
        id: run.id,
        gridIndex: run.gridIndex,
        weights: {
          narrative: run.candidate.narrativeWeight,
          article: run.candidate.articleWeight,
          attributes: run.candidate.attributeGroupWeight,
        },
        retrieval: {
          maxReferences: run.candidate.maxReferences,
          minReferences: run.candidate.minReferences,
          minScore: run.candidate.minScore,
          minAttributeCoverage: run.candidate.minAttributeCoverage,
        },
        configFingerprint: run.candidate.configFingerprint,
        eligibleUnitCount: run.eligibleUnitCount,
        estimatedUnitCount: run.estimatedUnitCount,
        coverage: run.report.coverage,
        cbr: run.report.cbr,
        baselineOnAcceptedUnits: run.report.baselineOnAcceptedUnits,
        baselineOnEligibleUnits: run.report.baselineOnEligibleUnits,
        withheldReasons: run.report.withheldReasons,
        perCategory: run.report.perCategory,
      })),
      scores: selection.scores.map((entry) => ({
        id: entry.candidate.id,
        gridIndex: entry.candidate.gridIndex,
        coverage: entry.coverage,
        maeDays: Number.isFinite(entry.maeDays) ? entry.maeDays : null,
      })),
    },
    selected: {
      id: selected.id,
      gridIndex: selected.gridIndex,
      rule: selection.rule,
      targetMet: selection.targetMet,
      config: selected.config,
      configFingerprint: selected.configFingerprint,
      validationFingerprint: predictionFingerprint(
        selectedRun.details,
        selectedRun.predictions,
      ),
    },
    notes: [
      'Konfigurasi dipilih hanya dari split validasi; target test tidak dibaca pada tahap ini.',
      'Pemilihan memakai MAE terendah di antara kandidat yang mencapai target cakupan, lalu cakupan tertinggi, lalu urutan grid.',
      'Detail per unit untuk seluruh kandidat disimpan di workspace evaluasi.',
    ],
  };
  writeJson(reportPath, report);

  const lock: LockedEvaluationConfig = {
    schemaVersion: 1,
    lockedAt: isoNow(options),
    manifestFingerprint: state.manifest.fingerprints.manifest,
    snapshot: state.manifest.source,
    seed: state.manifest.seed,
    proportions: state.manifest.proportions,
    selected: {
      id: selected.id,
      gridIndex: selected.gridIndex,
      rule: selection.rule,
      targetMet: selection.targetMet,
    },
    config: selected.config,
    configFingerprint: selected.configFingerprint,
    validationReport: EVALUATION_VALIDATION_FILE,
    evaluation: {
      coverageTarget: EVALUATION_PROTOCOL.coverageTarget,
      preprocessing: EVALUATION_PROTOCOL.preprocessing,
      gridProtocol: EVALUATION_PROTOCOL.gridProtocol,
      selectionRule: EVALUATION_PROTOCOL.selectionRule,
      enumerationOrder: EVALUATION_PROTOCOL.enumerationOrder,
    },
    notes: [
      'Konfigurasi dikunci sebelum penilaian test.',
      'Perubahan manifest atau snapshot membuat kunci ini tidak berlaku; jalankan ulang prepare dan validate.',
    ],
  };
  const lockPath = join(state.artifacts, EVALUATION_LOCK_FILE);
  writeJson(lockPath, lock);

  const perUnitPath = join(state.workspace, EVALUATION_VALIDATION_UNITS_FILE);
  writeJsonLines(perUnitPath, perUnitLines);

  return {
    status: 'validated',
    exitCode: 0,
    reportPath,
    lockPath,
    perUnitPath,
    manifestFingerprint: state.manifest.fingerprints.manifest,
    selected: {
      id: selected.id,
      gridIndex: selected.gridIndex,
      rule: selection.rule,
      targetMet: selection.targetMet,
      configFingerprint: selected.configFingerprint,
      coverage: selectedRun.report.coverage,
      cbr: selectedRun.report.cbr,
    },
    gridCandidateCount: runs.length,
    unitDetailsPath: perUnitPath,
  };
}

function loadLock(
  state: EvaluationState,
): LockedEvaluationConfig {
  const lockPath = join(state.artifacts, EVALUATION_LOCK_FILE);
  const lock = readJson<LockedEvaluationConfig>(
    lockPath,
    'Konfigurasi terkunci',
    'KONFIGURASI_TERKUNCI_TIDAK_ADA',
  );

  if (
    lock.manifestFingerprint !== state.manifest.fingerprints.manifest ||
    lock.seed !== state.manifest.seed ||
    lock.configFingerprint !== retrievalConfigFingerprint(lock.config) ||
    lock.evaluation === undefined ||
    lock.evaluation.gridProtocol !== EVALUATION_PROTOCOL.gridProtocol ||
    lock.evaluation.coverageTarget !== EVALUATION_PROTOCOL.coverageTarget ||
    stableHash(lock.evaluation.preprocessing) !==
      stableHash(EVALUATION_PROTOCOL.preprocessing)
  ) {
    throw new EvaluationError(
      'KONFIGURASI_TERKUNCI_TIDAK_COCOK',
      'Konfigurasi terkunci tidak cocok dengan manifest, protokol, atau snapshot saat ini. Jalankan ulang prepare dan validate; hasil run lama tidak dipakai ulang.',
      {
        lockPath,
        lockedManifest: lock.manifestFingerprint,
        currentManifest: state.manifest.fingerprints.manifest,
        lockProtocol: lock.evaluation.gridProtocol,
        currentProtocol: EVALUATION_PROTOCOL.gridProtocol,
      },
    );
  }

  return lock;
}

interface TestVariant {
  id: string;
  description: string;
  weights: 'combined' | 'narration-only';
  aggregation: 'weighted' | 'unweighted';
  config: RetrievalConfig;
  configFingerprint: string;
  details: UnitPredictionDetail[];
  predictions: EvaluationPrediction[];
}

export function testEvaluation(options: EvaluationOptions): EvaluationStageResult {
  const state = loadState(options);
  const lock = loadLock(state);
  const trainingCases = casesBySplit(state, 'training');
  const testCases = casesBySplit(state, 'test');
  const baseline = baselineFor(trainingCases);
  const indexCache = new Map<string, RetrievalIndex>();

  const combinedIndex = indexForConfig(trainingCases, lock.config, indexCache);
  const narrationConfig = buildNarrationOnlyConfig(lock.config);
  const narrationIndex = indexForConfig(trainingCases, narrationConfig, indexCache);

  const combinedDetails = predictSplit(combinedIndex, testCases);
  const narrationDetails = predictSplit(narrationIndex, testCases);

  const variants: TestVariant[] = [
    {
      id: 'cbr-gabungan-berbobot',
      description: 'Input gabungan dengan Reuse berbobot (konfigurasi terkunci).',
      weights: 'combined',
      aggregation: 'weighted',
      config: lock.config,
      configFingerprint: lock.configFingerprint,
      details: combinedDetails,
      predictions: combinedDetails.map((detail) => detail.prediction),
    },
    {
      id: 'cbr-narasi-berbobot',
      description: 'Narasi saja dengan Reuse berbobot (bobot 1/0/0).',
      weights: 'narration-only',
      aggregation: 'weighted',
      config: narrationConfig,
      configFingerprint: retrievalConfigFingerprint(narrationConfig),
      details: narrationDetails,
      predictions: narrationDetails.map((detail) => detail.prediction),
    },
    {
      id: 'cbr-gabungan-tanpa-bobot',
      description: 'Input gabungan dengan agregasi aritmetika tanpa bobot.',
      weights: 'combined',
      aggregation: 'unweighted',
      config: lock.config,
      configFingerprint: lock.configFingerprint,
      details: combinedDetails,
      predictions: combinedDetails.map((detail) => {
        const estimate = unweightedReuse(detail.result);
        return {
          ...detail.prediction,
          estimatedSentenceDays: estimate,
          withheldReason:
            estimate === null
              ? (detail.result.withholding?.code ?? 'REFERENSI_TIDAK_CUKUP')
              : null,
        };
      }),
    },
  ];

  const perUnitLines: unknown[] = [];
  const modelReports = variants.map((variant) => {
    for (let index = 0; index < variant.details.length; index += 1) {
      const detail = variant.details[index] as UnitPredictionDetail;
      const prediction = variant.predictions[index] as EvaluationPrediction;
      perUnitLines.push(
        perUnitLine(
          'test',
          variant.id,
          detail,
          prediction.estimatedSentenceDays ?? null,
          prediction.withheldReason ?? null,
        ),
      );
    }

    return {
      id: variant.id,
      description: variant.description,
      weights: variant.weights,
      aggregation: variant.aggregation,
      config: variant.config,
      configFingerprint: variant.configFingerprint,
      predictionFingerprint: predictionFingerprint(
        variant.details,
        variant.predictions,
      ),
      report: evaluatePredictions(variant.predictions, baseline),
    };
  });

  const commonAccepted = new Set(testCases.map((unit) => unit.id));
  for (const variant of variants) {
    for (const prediction of variant.predictions) {
      if (typeof prediction.estimatedSentenceDays !== 'number') {
        commonAccepted.delete(prediction.unitId);
      }
    }
  }

  const pairedModels = variants.map((variant, index) => {
    const filtered = variant.predictions.filter((prediction) =>
      commonAccepted.has(prediction.unitId),
    );
    const report: EvaluationReport = evaluatePredictions(filtered, baseline);
    return {
      id: variant.id,
      model: modelReports[index]?.id,
      cbr: report.cbr,
      baselineOnAcceptedUnits: report.baselineOnAcceptedUnits,
    };
  });

  const reportPath = join(state.artifacts, EVALUATION_TEST_FILE);
  const report = {
    schemaVersion: 1,
    status: 'tested',
    createdAt: isoNow(options),
    manifestFingerprint: state.manifest.fingerprints.manifest,
    lockFingerprint: lock.configFingerprint,
    snapshot: state.manifest.source,
    seed: state.manifest.seed,
    proportions: state.manifest.proportions,
    protocol: EVALUATION_PROTOCOL,
    dataset: {
      training: {
        units: state.split.summary.training.unitCount,
        groups: state.split.summary.training.groupCount,
      },
      test: {
        units: state.split.summary.test.unitCount,
        groups: state.split.summary.test.groupCount,
        categories: state.manifest.perSplit.test.categories,
        categoryUnknown: state.manifest.perSplit.test.categoryUnknown,
        eligiblePositiveOutcome:
          state.manifest.perSplit.test.eligiblePositiveOutcome,
      },
    },
    baseline,
    models: modelReports,
    paired: {
      unitCount: commonAccepted.size,
      models: pairedModels,
    },
    checks: {
      groupsDisjoint: state.manifest.checks.groupsDisjoint,
      everyUnitAssignedOnce: state.manifest.checks.everyUnitAssignedOnce,
      manifestMatchesSnapshot: true,
      lockMatchesManifest: true,
    },
    notes: [
      'Test memakai konfigurasi yang dikunci pada tahap validasi; hasil test tidak dipakai untuk memilih ulang.',
      'Hasil aktual test tidak ditambahkan ke basis kasus selama pengukuran prediksi.',
      'Galat pembanding pada irisan unit yang sama dilaporkan bersama galat CBR.',
      'Perubahan manifest atau snapshot membuat kunci tidak berlaku, bukan memakai ulang hasil run sebelumnya.',
    ],
  };
  writeJson(reportPath, report);

  const perUnitPath = join(state.workspace, EVALUATION_TEST_UNITS_FILE);
  writeJsonLines(perUnitPath, perUnitLines);

  return {
    status: 'tested',
    exitCode: 0,
    reportPath,
    perUnitPath,
    manifestFingerprint: state.manifest.fingerprints.manifest,
    lockFingerprint: lock.configFingerprint,
    selected: lock.selected,
    models: modelReports.map((model) => ({
      id: model.id,
      aggregation: model.aggregation,
      predictionFingerprint: model.predictionFingerprint,
      coverage: model.report.coverage,
      cbr: model.report.cbr,
      baselineOnAcceptedUnits: model.report.baselineOnAcceptedUnits,
      baselineOnEligibleUnits: model.report.baselineOnEligibleUnits,
    })),
    paired: report.paired,
    unitDetailsPath: perUnitPath,
  };
}

function resolveOptions(options: EvaluationOptions): Required<
  Pick<EvaluationOptions, 'stage'>
> &
  EvaluationOptions {
  return { ...options, stage: options.stage ?? 'all' };
}

export function runEvaluation(options: EvaluationOptions): EvaluationStageResult {
  const resolved = resolveOptions(options);
  if (resolved.stage === 'prepare') {
    return prepareEvaluation(resolved);
  }
  if (resolved.stage === 'validate') {
    return validateEvaluation(resolved);
  }
  if (resolved.stage === 'test') {
    return testEvaluation(resolved);
  }

  const prepared = prepareEvaluation(resolved);
  const validated = validateEvaluation(resolved);
  if (validated.status === 'postponed') {
    return {
      ...validated,
      prepare: prepared,
      stage: 'all',
    };
  }
  const tested = testEvaluation(resolved);
  return {
    status: tested.status,
    exitCode: tested.exitCode,
    stage: 'all',
    prepare: prepared,
    validate: validated,
    test: tested,
  };
}
