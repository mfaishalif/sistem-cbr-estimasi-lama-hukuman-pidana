import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { SnapshotFileEntry, SnapshotManifest } from './types';
import type { IndoLawDocument } from './xml';
import { SECTION_TAGS } from './xml';

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

export interface DiscoveredFile {
  absolutePath: string;
  relativePath: string;
  manifestEntry: SnapshotFileEntry | null;
}

export interface DiscoveredSnapshot {
  root: string;
  datasetRoot: string;
  manifestPath: string | null;
  manifest: SnapshotManifest | null;
  files: DiscoveredFile[];
}

function isManifest(value: unknown): value is SnapshotManifest {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<SnapshotManifest>;
  return (
    candidate.schemaVersion === 1 &&
    candidate.source !== undefined &&
    typeof candidate.source.commit === 'string' &&
    candidate.extraction !== undefined &&
    typeof candidate.extraction.datasetPath === 'string' &&
    Array.isArray(candidate.extraction.files)
  );
}

function readManifest(manifestPath: string): SnapshotManifest {
  const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
  if (!isManifest(parsed)) {
    throw new SnapshotError(`manifest tidak dikenali: ${manifestPath}`);
  }
  return parsed;
}

function walkXmlFiles(directory: string, root: string): DiscoveredFile[] {
  const files: DiscoveredFile[] = [];

  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolutePath = join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
        files.push({
          absolutePath,
          relativePath: relative(root, absolutePath).replace(/\\/g, '/'),
          manifestEntry: null,
        });
      }
    }
  };

  visit(directory);
  return files;
}

/**
 * Find a pinned snapshot. A manifest is preferred, but a directory of XML
 * files is accepted for synthetic import checks. No source outside the given
 * directory is read.
 */
export function discoverSnapshot(sourceDir: string): DiscoveredSnapshot {
  const requestedRoot = resolve(sourceDir);
  if (!existsSync(requestedRoot) || !statSync(requestedRoot).isDirectory()) {
    throw new SnapshotError(`direktori sumber tidak ditemukan: ${requestedRoot}`);
  }

  let root = requestedRoot;
  let manifestPath: string | null = null;

  if (existsSync(join(root, 'manifest.json'))) {
    manifestPath = join(root, 'manifest.json');
  } else {
    const childDirectories = readdirSync(root, { withFileTypes: true }).filter((entry) =>
      entry.isDirectory(),
    );
    const withManifest = childDirectories
      .map((entry) => join(root, entry.name, 'manifest.json'))
      .find((candidate) => existsSync(candidate));
    if (withManifest !== undefined) {
      manifestPath = withManifest;
      root = resolve(withManifest, '..');
    }
  }

  const manifest = manifestPath === null ? null : readManifest(manifestPath);
  const datasetRoot =
    manifest === null ? root : join(root, manifest.extraction.datasetPath);

  if (!existsSync(datasetRoot) || !statSync(datasetRoot).isDirectory()) {
    throw new SnapshotError(`direktori dataset tidak ditemukan: ${datasetRoot}`);
  }

  const manifestEntries = new Map<string, SnapshotFileEntry>();
  if (manifest !== null) {
    for (const entry of manifest.extraction.files) {
      manifestEntries.set(entry.path.replace(/\\/g, '/'), entry);
    }
  }

  const files =
    manifest === null
      ? walkXmlFiles(datasetRoot, root)
      : manifest.extraction.files.map((entry) => {
          const normalizedPath = entry.path.replace(/\\/g, '/');
          return {
            absolutePath: join(datasetRoot, normalizedPath),
            relativePath: normalizedPath,
            manifestEntry: entry,
          };
        });

  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  return {
    root,
    datasetRoot,
    manifestPath,
    manifest,
    files,
  };
}

export function sha256Hex(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Whitespace/format-insensitive content hash used to merge format copies. */
export function normalizedXmlContentHash(document: IndoLawDocument): string {
  const canonical = {
    classification: document.classification,
    subClassification: document.subClassification,
    courtSlug: document.courtSlug,
    province: document.province,
    status: document.status,
    amar: document.amar,
    amarOther: document.amarOther,
    metadataSentenceRaw: document.metadataSentenceRaw,
    sections: SECTION_TAGS.map((tag) => [
      tag,
      (document.sections[tag] ?? '').toLowerCase().replace(/\s+/g, ' ').trim(),
    ]),
  };
  return sha256Hex(JSON.stringify(canonical));
}

export function deterministicId(prefix: string, ...parts: readonly (string | number)[]): string {
  return `${prefix}_${sha256Hex(parts.join('|')).slice(0, 32)}`;
}
