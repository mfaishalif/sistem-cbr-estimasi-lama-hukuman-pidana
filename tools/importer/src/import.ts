import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { FACT_ATTRIBUTE_KEYS } from '@cbr/core';
import type { CaseUnitDraft } from '@cbr/core';
import {
  clearCaseBase,
  closeDatabase,
  createCaseUnit,
  ensureCaseGroup,
  getDatabaseStatus,
  insertSourceAlias,
  insertSourceDocument,
  linkCaseUnitSource,
  openDatabase,
  runMigrations,
  withTransaction,
} from '@cbr/data';
import { extractIndictmentArticles } from './articles';
import { extractOptionalAttributes } from './attributes';
import { normalizeCategory } from './category';
import {
  extractCaseIdentity,
  extractRelatedCaseKeys,
  IdentityError,
  normalizeCasePart,
  type CaseIdentity,
} from './identity';
import { buildNarrative } from './narrative';
import { resolveOutcome } from './outcome';
import {
  deterministicId,
  discoverSnapshot,
  normalizedXmlContentHash,
  sha256Hex,
  SnapshotError,
  type DiscoveredFile,
  type DiscoveredSnapshot,
} from './snapshot';
import type {
  ExtractedCase,
  ImportOptions,
  ImportReport,
  SkipCode,
  SkipRecord,
  SnapshotManifest,
} from './types';
import { parseIndoLawXml, collapseWhitespace } from './xml';

interface SourceDocumentDraft {
  id: string;
  contentHash: string;
  normalizedContentHash: string | null;
  snapshotPath: string;
  sourceUrl: string | null;
  retrievedAt: string | null;
}

interface AliasDraft {
  id: string;
  sourceDocumentId: string;
  aliasType: 'path' | 'xml_id' | 'url';
  aliasValue: string;
}

interface ImportAccumulator {
  documentsParsed: number;
  documentsSkipped: number;
  caseSkipCount: number;
  sourceDocuments: SourceDocumentDraft[];
  sourceByContentHash: Map<string, SourceDocumentDraft>;
  sourceByNormalizedHash: Map<string, SourceDocumentDraft>;
  aliases: AliasDraft[];
  cases: ExtractedCase[];
  skips: SkipRecord[];
  pathToDocumentId: Map<string, string>;
  aliasConflicts: number;
  copyDocuments: number;
  parseMs: number;
  extractionMs: number;
  bytesRead: number;
  filesRead: number;
}

function skip(accumulator: ImportAccumulator, code: SkipCode, sourcePath: string): void {
  accumulator.skips.push({ code, sourcePath });
}

function uniquePaths(paths: readonly string[]): string[] {
  return [...new Set(paths)].sort((left, right) => left.localeCompare(right));
}

function readManifestMetadata(snapshot: DiscoveredSnapshot): {
  manifestVerified: boolean;
  commit: string | null;
  datasetTree: string | null;
  archiveSha256: string | null;
  retrievedAt: string | undefined;
} {
  const manifest: SnapshotManifest | null = snapshot.manifest;
  if (manifest === null) {
    return {
      manifestVerified: false,
      commit: null,
      datasetTree: null,
      archiveSha256: null,
      retrievedAt: undefined,
    };
  }

  return {
    manifestVerified:
      /^[0-9a-f]{40}$/i.test(manifest.source.commit) &&
      /^[0-9a-f]{64}$/i.test(manifest.source.archiveSha256),
    commit: manifest.source.commit,
    datasetTree: manifest.source.datasetTree,
    archiveSha256: manifest.source.archiveSha256,
    retrievedAt: manifest.source.downloadedAt,
  };
}

function hashMismatch(file: DiscoveredFile, actualHash: string): boolean {
  return file.manifestEntry !== null && file.manifestEntry.sha256 !== actualHash;
}

function documentMetadataMissing(document: ReturnType<typeof parseIndoLawXml>): boolean {
  return (
    document.classification.trim().length === 0 ||
    document.subClassification.trim().length === 0 ||
    document.courtSlug.trim().length === 0
  );
}

function extractCase(
  document: ReturnType<typeof parseIndoLawXml>,
  sourcePath: string,
): { ok: true; value: ExtractedCase } | { ok: false; code: SkipCode } {
  let identity: CaseIdentity;
  try {
    identity = extractCaseIdentity(document);
  } catch (error) {
    if (error instanceof IdentityError) {
      return { ok: false, code: error.code };
    }
    throw error;
  }

  const articles = extractIndictmentArticles(document);
  const category = normalizeCategory(document, articles);
  if (category.coverageError !== null) {
    return { ok: false, code: category.coverageError.code };
  }

  const outcome = resolveOutcome(document);
  if (!outcome.ok) {
    return { ok: false, code: outcome.code };
  }

  const narrative = buildNarrative(document, identity);
  if (!narrative.ok) {
    return { ok: false, code: narrative.code };
  }

  const groupKey = `${identity.courtNormalized}|${identity.caseNumberNormalized}`;
  return {
    ok: true,
    value: {
      sourcePaths: [sourcePath],
      sourceUrl: document.url,
      court: identity.court,
      caseNumber: identity.caseNumber,
      courtNormalized: identity.courtNormalized,
      caseNumberNormalized: identity.caseNumberNormalized,
      defendantName: identity.defendantName,
      defendantNormalized: identity.defendantNormalized,
      narration: narrative.text,
      narrationLocation: narrative.location,
      category: category.category,
      categorySourceLocation: category.sourceLocation,
      actualSentenceDays: outcome.days,
      outcomeLocation: outcome.location,
      outcomeSourceValue: collapseWhitespace(outcome.raw).slice(0, 500),
      outcomeSourceUnit: 'hari',
      outcomeKind: outcome.kind,
      articles,
      attributes: extractOptionalAttributes(document, narrative.text),
      groupKey,
      unitKey: `${groupKey}|${identity.defendantNormalized}`,
      relatedCaseKeys: extractRelatedCaseKeys(document, identity),
    },
  };
}

function processFile(
  file: DiscoveredFile,
  manifest: ReturnType<typeof readManifestMetadata>,
  accumulator: ImportAccumulator,
): void {
  let bytes: Buffer;
  try {
    bytes = readFileSync(file.absolutePath);
  } catch {
    accumulator.documentsSkipped += 1;
    skip(accumulator, 'unreadable_file', file.relativePath);
    return;
  }

  accumulator.filesRead += 1;
  accumulator.bytesRead += bytes.length;
  const contentHash = sha256Hex(bytes);

  if (hashMismatch(file, contentHash)) {
    accumulator.documentsSkipped += 1;
    skip(accumulator, 'unreadable_file', file.relativePath);
    return;
  }

  let document: ReturnType<typeof parseIndoLawXml>;
  const parseStart = performance.now();
  try {
    document = parseIndoLawXml(bytes.toString('utf8'));
  } catch (error) {
    accumulator.parseMs += performance.now() - parseStart;
    accumulator.documentsSkipped += 1;
    skip(accumulator, 'invalid_xml', file.relativePath);
    return;
  }
  accumulator.parseMs += performance.now() - parseStart;

  const extractionStart = performance.now();
  accumulator.documentsParsed += 1;

  const normalizedHash = normalizedXmlContentHash(document);
  const normalizedPath = file.relativePath.replace(/\\/g, '/');

  let sourceDocument =
    accumulator.sourceByContentHash.get(contentHash) ??
    accumulator.sourceByNormalizedHash.get(normalizedHash);

  if (sourceDocument === undefined) {
    sourceDocument = {
      id: deterministicId('src', contentHash),
      contentHash,
      normalizedContentHash: normalizedHash,
      snapshotPath: normalizedPath,
      sourceUrl: document.url,
      retrievedAt: manifest.retrievedAt ?? null,
    };
    accumulator.sourceDocuments.push(sourceDocument);
    accumulator.sourceByContentHash.set(contentHash, sourceDocument);
    accumulator.sourceByNormalizedHash.set(normalizedHash, sourceDocument);
  } else {
    accumulator.copyDocuments += 1;
  }

  accumulator.pathToDocumentId.set(normalizedPath, sourceDocument.id);

  const aliases: Array<{ type: 'path' | 'xml_id' | 'url'; value: string }> = [
    { type: 'path', value: normalizedPath },
  ];
  if (document.xmlId.length > 0) {
    aliases.push({ type: 'xml_id', value: document.xmlId });
  }
  if (document.url !== null && document.url.length > 0) {
    aliases.push({ type: 'url', value: document.url });
  }
  for (const alias of aliases) {
    accumulator.aliases.push({
      id: deterministicId('alias', alias.type, alias.value),
      sourceDocumentId: sourceDocument.id,
      aliasType: alias.type,
      aliasValue: alias.value,
    });
  }

  if (documentMetadataMissing(document)) {
    accumulator.caseSkipCount += 1;
    skip(accumulator, 'document_metadata_missing', normalizedPath);
    accumulator.extractionMs += performance.now() - extractionStart;
    return;
  }

  const status = normalizeCasePart(document.status);
  if (status.length > 0 && status !== 'berkekuatanhukumtetap') {
    accumulator.caseSkipCount += 1;
    skip(accumulator, 'coverage_doubtful', normalizedPath);
    accumulator.extractionMs += performance.now() - extractionStart;
    return;
  }

  const outcome = extractCase(document, normalizedPath);
  if (!outcome.ok) {
    accumulator.caseSkipCount += 1;
    skip(accumulator, outcome.code, normalizedPath);
    accumulator.extractionMs += performance.now() - extractionStart;
    return;
  }

  accumulator.cases.push(outcome.value);
  accumulator.extractionMs += performance.now() - extractionStart;
}

function resolveConflicts(accumulator: ImportAccumulator): {
  cases: ExtractedCase[];
  conflicts: number;
  conflictSkips: SkipRecord[];
} {
  const byUnitKey = new Map<string, ExtractedCase[]>();
  for (const candidate of accumulator.cases) {
    const existing = byUnitKey.get(candidate.unitKey);
    if (existing === undefined) {
      byUnitKey.set(candidate.unitKey, [candidate]);
    } else {
      existing.push(candidate);
    }
  }

  const cases: ExtractedCase[] = [];
  const conflictSkips: SkipRecord[] = [];
  let conflicts = 0;

  for (const candidates of byUnitKey.values()) {
    candidates.sort((left, right) =>
      (left.sourcePaths[0] ?? '').localeCompare(right.sourcePaths[0] ?? ''),
    );
    const outcomes = new Set(candidates.map((candidate) => candidate.actualSentenceDays));
    if (outcomes.size > 1) {
      conflicts += 1;
      for (const candidate of candidates) {
        for (const sourcePath of candidate.sourcePaths) {
          conflictSkips.push({ code: 'identity_outcome_conflict', sourcePath });
        }
      }
      continue;
    }

    const first = candidates[0];
    if (first === undefined) {
      continue;
    }
    cases.push({
      ...first,
      sourcePaths: uniquePaths(candidates.flatMap((candidate) => candidate.sourcePaths)),
    });
  }

  cases.sort((left, right) => left.unitKey.localeCompare(right.unitKey));
  return { cases, conflicts, conflictSkips };
}

class UnionFind {
  private readonly parent = new Map<string, string>();

  find(value: string): string {
    const current = this.parent.get(value);
    if (current === undefined) {
      this.parent.set(value, value);
      return value;
    }
    if (current !== value) {
      const root = this.find(current);
      this.parent.set(value, root);
      return root;
    }
    return value;
  }

  union(left: string, right: string): boolean {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot === rightRoot) {
      return false;
    }
    const [first, second] = [leftRoot, rightRoot].sort();
    if (first !== undefined && second !== undefined) {
      this.parent.set(second, first);
    }
    return true;
  }
}

function buildGroups(cases: readonly ExtractedCase[]): {
  finalGroupKeyByCase: Map<string, string>;
  groupCount: number;
  largestGroup: number;
  relatedLinks: number;
  relatedGroupsMerged: number;
} {
  const groupKeys = new Set(cases.map((candidate) => candidate.groupKey));
  const unionFind = new UnionFind();
  let relatedLinks = 0;
  let relatedGroupsMerged = 0;

  for (const candidate of cases) {
    for (const relatedKey of candidate.relatedCaseKeys) {
      if (!groupKeys.has(relatedKey)) {
        continue;
      }
      relatedLinks += 1;
      if (unionFind.union(candidate.groupKey, relatedKey)) {
        relatedGroupsMerged += 1;
      }
    }
  }

  const membersByRoot = new Map<string, string[]>();
  for (const groupKey of [...groupKeys].sort()) {
    const root = unionFind.find(groupKey);
    const members = membersByRoot.get(root);
    if (members === undefined) {
      membersByRoot.set(root, [groupKey]);
    } else {
      members.push(groupKey);
    }
  }

  const finalGroupKeyByGroup = new Map<string, string>();
  for (const members of membersByRoot.values()) {
    const sorted = [...members].sort();
    const finalKey = sorted.join('|');
    for (const member of sorted) {
      finalGroupKeyByGroup.set(member, finalKey);
    }
  }

  const finalGroupKeyByCase = new Map<string, string>();
  const unitsPerFinalGroup = new Map<string, number>();
  for (const candidate of cases) {
    const finalKey = finalGroupKeyByGroup.get(candidate.groupKey) ?? candidate.groupKey;
    finalGroupKeyByCase.set(candidate.unitKey, finalKey);
    unitsPerFinalGroup.set(finalKey, (unitsPerFinalGroup.get(finalKey) ?? 0) + 1);
  }

  return {
    finalGroupKeyByCase,
    groupCount: unitsPerFinalGroup.size,
    largestGroup: Math.max(0, ...unitsPerFinalGroup.values()),
    relatedLinks,
    relatedGroupsMerged,
  };
}

function buildReport(
  accumulator: ImportAccumulator,
  cases: readonly ExtractedCase[],
  conflicts: number,
  conflictSkips: readonly SkipRecord[],
  groups: ReturnType<typeof buildGroups>,
  status: ReturnType<typeof getDatabaseStatus>,
  snapshot: DiscoveredSnapshot,
  manifest: ReturnType<typeof readManifestMetadata>,
  databasePath: string,
  mode: 'replace' | 'append',
  timing: ImportReport['timing'],
): ImportReport {
  const skipMap = new Map<SkipCode, { count: number; examples: string[] }>();
  for (const record of [...accumulator.skips, ...conflictSkips]) {
    const entry = skipMap.get(record.code) ?? { count: 0, examples: [] };
    entry.count += 1;
    if (entry.examples.length < 5 && !entry.examples.includes(record.sourcePath)) {
      entry.examples.push(record.sourcePath);
    }
    skipMap.set(record.code, entry);
  }

  const categories: Record<string, number> = {};
  const attributes: Record<string, { present: number; total: number }> = {};
  for (const key of FACT_ATTRIBUTE_KEYS) {
    attributes[key] = { present: 0, total: cases.length };
  }
  let categoryUnknown = 0;
  const outcomes = { metadataOnly: 0, metadataAndVerdict: 0 };

  for (const candidate of cases) {
    if (candidate.category === null) {
      categoryUnknown += 1;
    } else {
      categories[candidate.category] = (categories[candidate.category] ?? 0) + 1;
    }
    for (const key of Object.keys(candidate.attributes)) {
      const entry = attributes[key];
      if (entry !== undefined) {
        entry.present += 1;
      } else {
        attributes[key] = { present: 1, total: cases.length };
      }
    }
    if (candidate.outcomeKind === 'metadata') {
      outcomes.metadataOnly += 1;
    } else {
      outcomes.metadataAndVerdict += 1;
    }
  }

  return {
    status: 'ok',
    database: databasePath,
    mode,
    databaseStatus: {
      schemaVersion: status.schemaVersion,
      caseUnits: status.caseUnits,
      caseGroups: status.caseGroups,
      generation: status.generation,
    },
    source: {
      root: snapshot.root,
      manifestPath: snapshot.manifestPath,
      commit: manifest.commit,
      datasetTree: manifest.datasetTree,
      archiveSha256: manifest.archiveSha256,
      filesFound: snapshot.files.length,
      filesRead: accumulator.filesRead,
      bytesRead: accumulator.bytesRead,
      manifestVerified: manifest.manifestVerified,
    },
    counts: {
      documentsParsed: accumulator.documentsParsed,
      documentsSkipped: accumulator.documentsSkipped,
      casesAccepted: cases.length,
      casesSkipped: accumulator.caseSkipCount + conflictSkips.length,
      caseGroups: groups.groupCount,
      sourceDocuments: status.sourceDocuments,
      sourceAliases: status.sourceAliases,
      copiesMerged: accumulator.copyDocuments,
      relatedGroupsMerged: groups.relatedGroupsMerged,
      conflicts: conflicts + accumulator.aliasConflicts,
    },
    skipReasons: [...skipMap.entries()]
      .map(([code, entry]) => ({ code, ...entry }))
      .sort((left, right) => left.code.localeCompare(right.code)),
    categories,
    categoryUnknown,
    attributes,
    outcomes,
    grouping: {
      largestGroup: groups.largestGroup,
      relatedLinks: groups.relatedLinks,
      relatedGroupsMerged: groups.relatedGroupsMerged,
    },
    timing,
  };
}

function writeCases(
  db: ReturnType<typeof openDatabase>,
  cases: readonly ExtractedCase[],
  accumulator: ImportAccumulator,
  groups: ReturnType<typeof buildGroups>,
): void {
  for (const sourceDocument of accumulator.sourceDocuments) {
    insertSourceDocument(db, {
      id: sourceDocument.id,
      contentHash: sourceDocument.contentHash,
      normalizedContentHash: sourceDocument.normalizedContentHash,
      snapshotPath: sourceDocument.snapshotPath,
      sourceUrl: sourceDocument.sourceUrl,
      retrievedAt: sourceDocument.retrievedAt,
    });
  }

  for (const alias of accumulator.aliases) {
    const result = insertSourceAlias(db, alias);
    if (!result.inserted && result.conflict) {
      accumulator.aliasConflicts += 1;
    }
  }

  const ensuredGroups = new Set<string>();
  for (const candidate of cases) {
    const finalGroupKey = groups.finalGroupKeyByCase.get(candidate.unitKey) ?? candidate.groupKey;
    const caseGroupId = deterministicId('grp', finalGroupKey);
    if (!ensuredGroups.has(caseGroupId)) {
      ensureCaseGroup(db, caseGroupId);
      ensuredGroups.add(caseGroupId);
    }

    const unitId = deterministicId('unit', candidate.groupKey, candidate.defendantNormalized);
    const draft: CaseUnitDraft = {
      court: candidate.court,
      caseNumber: candidate.caseNumber,
      defendantName: candidate.defendantName,
      narration: candidate.narration,
      category: candidate.category,
      categorySourceLocation: candidate.categorySourceLocation,
      actualSentenceDays: candidate.actualSentenceDays,
      caseGroupId,
      articles: candidate.articles,
      attributes: candidate.attributes,
    };

    let call = 0;
    const idFactory = (): string => {
      if (call === 0) {
        call += 1;
        return unitId;
      }
      call += 1;
      return deterministicId('part', unitId, call);
    };

    createCaseUnit(db, draft, idFactory);

    for (const sourcePath of candidate.sourcePaths) {
      const sourceDocumentId = accumulator.pathToDocumentId.get(sourcePath);
      if (sourceDocumentId === undefined) {
        continue;
      }
      linkCaseUnitSource(db, {
        caseUnitId: unitId,
        sourceDocumentId,
        narrationLocation: candidate.narrationLocation,
        outcomeLocation: candidate.outcomeLocation,
        notes: null,
        sourceOutcomeValue: candidate.outcomeSourceValue,
        sourceOutcomeUnit: candidate.outcomeSourceUnit,
        sourceOutcomeKind: candidate.outcomeKind,
      });
    }
  }
}

/**
 * Import one pinned Indo-Law snapshot. The case base is replaced atomically by
 * default; application configuration is left untouched. Raw dataset content is
 * never copied into the report.
 */
export function runImport(options: ImportOptions): ImportReport {
  const totalStart = performance.now();
  const discoveryStart = performance.now();
  const snapshot = discoverSnapshot(options.sourceDir);
  const discoveryMs = performance.now() - discoveryStart;
  const manifest = readManifestMetadata(snapshot);
  const mode: 'replace' | 'append' = options.replace === false ? 'append' : 'replace';

  const accumulator: ImportAccumulator = {
    documentsParsed: 0,
    documentsSkipped: 0,
    caseSkipCount: 0,
    sourceDocuments: [],
    sourceByContentHash: new Map(),
    sourceByNormalizedHash: new Map(),
    aliases: [],
    cases: [],
    skips: [],
    pathToDocumentId: new Map(),
    aliasConflicts: 0,
    copyDocuments: 0,
    parseMs: 0,
    extractionMs: 0,
    bytesRead: 0,
    filesRead: 0,
  };

  const files =
    options.limit === undefined
      ? snapshot.files
      : snapshot.files.slice(0, Math.max(0, Math.trunc(options.limit)));

  for (const file of files) {
    processFile(file, manifest, accumulator);
  }

  const resolved = resolveConflicts(accumulator);
  const groups = buildGroups(resolved.cases);

  const db = openDatabase(options.databasePath);
  let status: ReturnType<typeof getDatabaseStatus>;
  const writeStart = performance.now();
  try {
    runMigrations(db);
    withTransaction(db, () => {
      if (mode === 'replace') {
        clearCaseBase(db);
      }
      writeCases(db, resolved.cases, accumulator, groups);
    });
    status = getDatabaseStatus(db);
  } finally {
    closeDatabase(db);
  }
  const writeMs = performance.now() - writeStart;

  const timing = {
    discoveryMs,
    parseMs: accumulator.parseMs,
    extractionMs: accumulator.extractionMs,
    writeMs,
    totalMs: performance.now() - totalStart,
  };

  const report = buildReport(
    accumulator,
    resolved.cases,
    resolved.conflicts,
    resolved.conflictSkips,
    groups,
    status,
    snapshot,
    manifest,
    options.databasePath,
    mode,
    timing,
  );

  if (options.reportPath !== undefined) {
    mkdirSync(dirname(options.reportPath), { recursive: true });
    writeFileSync(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  return report;
}
