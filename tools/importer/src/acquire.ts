import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { sha256Hex } from './snapshot';
import type { SnapshotFileEntry, SnapshotManifest } from './types';

export const INDO_LAW_REPOSITORY = 'ir-nlp-csui/indo-law';
export const INDO_LAW_COMMIT = '67340338adbc63021630947d905627eef0d7e43f';
export const INDO_LAW_DATASET_TREE = '14db967106b2d10c968d73d7b061774b81f508c8';
export const INDO_LAW_ARCHIVE_SHA256 =
  'd033322c4086bfc3d688a8fef4f79a2dd912789a3db95874876d4f169847d124';
export const INDO_LAW_FILE_COUNT = 22630;
export const INDO_LAW_ARCHIVE_URL = `https://github.com/${INDO_LAW_REPOSITORY}/archive/${INDO_LAW_COMMIT}.zip`;

export interface AcquireOptions {
  destination: string;
  archivePath?: string;
  force?: boolean;
  commit?: string;
}

export interface AcquireResult {
  destination: string;
  datasetRoot: string;
  manifestPath: string;
  manifest: SnapshotManifest;
  downloaded: boolean;
}

function walkXml(directory: string, root: string): SnapshotFileEntry[] {
  const entries: SnapshotFileEntry[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
        const bytes = statSync(absolute).size;
        entries.push({
          path: relative(root, absolute).replace(/\\/g, '/'),
          sha256: sha256Hex(readFileSync(absolute)),
          bytes,
        });
      }
    }
  };
  visit(directory);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

export function buildManifestFromDataset(
  datasetRoot: string,
  source: SnapshotManifest['source'],
  datasetPath = 'dataset',
): SnapshotManifest {
  const files = walkXml(datasetRoot, datasetRoot);
  return {
    schemaVersion: 1,
    source,
    extraction: {
      datasetPath,
      fileCount: files.length,
      totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
      files,
    },
  };
}

async function downloadArchive(url: string, destination: string): Promise<string> {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || response.body === null) {
    throw new Error(`unduh arsip gagal: HTTP ${response.status} ${response.statusText}`);
  }

  const hash = createHash('sha256');
  const body = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
  body.on('data', (chunk: Buffer) => hash.update(chunk));

  await pipeline(body, createWriteStream(destination));
  return hash.digest('hex');
}

function extractArchive(archivePath: string, destination: string): void {
  mkdirSync(destination, { recursive: true });
  const command =
    process.platform === 'win32'
      ? { file: 'tar', args: ['-xf', archivePath, '-C', destination] }
      : { file: 'unzip', args: ['-q', archivePath, '-d', destination] };

  const result = spawnSync(command.file, command.args, { encoding: 'utf8' });
  if (result.error !== undefined) {
    throw new Error(
      `ekstraksi arsip gagal: ${result.error.message}. Prasyarat: tar (Windows) atau unzip (Linux/macOS).`,
    );
  }
  if (result.status !== 0) {
    throw new Error(`ekstraksi arsip gagal: ${result.stderr || result.stdout}`);
  }
}

/**
 * Download the pinned official source archive, extract it, and write a
 * snapshot manifest with archive and per-file SHA-256 hashes. Raw dataset
 * content stays in the caller's local destination and is never committed.
 */
export async function acquireIndoLawSnapshot(options: AcquireOptions): Promise<AcquireResult> {
  const destination = resolve(options.destination);
  const commit = options.commit ?? INDO_LAW_COMMIT;
  if (commit !== INDO_LAW_COMMIT) {
    throw new Error(
      `commit ${commit} tidak dipatok oleh alat ini; gunakan ${INDO_LAW_COMMIT} agar identitas snapshot tetap.`,
    );
  }

  const manifestPath = join(destination, 'manifest.json');
  const datasetRoot = join(destination, 'dataset');

  if (existsSync(manifestPath) && existsSync(datasetRoot) && options.force !== true) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as SnapshotManifest;
    if (
      manifest.source.commit !== commit ||
      manifest.source.archiveSha256 !== INDO_LAW_ARCHIVE_SHA256 ||
      manifest.extraction.fileCount !== INDO_LAW_FILE_COUNT
    ) {
      throw new Error(
        'manifest yang ada tidak cocok dengan snapshot resmi yang dipatok; jalankan dengan --force setelah memeriksa sumber.',
      );
    }
    return {
      destination,
      datasetRoot,
      manifestPath,
      manifest,
      downloaded: false,
    };
  }

  if (options.force === true) {
    rmSync(datasetRoot, { recursive: true, force: true });
    rmSync(manifestPath, { force: true });
    rmSync(join(destination, '_extract'), { recursive: true, force: true });
  }

  mkdirSync(destination, { recursive: true });
  const archivePath = options.archivePath ?? join(destination, `indo-law-${commit}.zip`);
  let downloaded = false;
  if (!existsSync(archivePath)) {
    await downloadArchive(INDO_LAW_ARCHIVE_URL, archivePath);
    downloaded = true;
  }

  const archiveSha256 = sha256Hex(readFileSync(archivePath));
  if (archiveSha256 !== INDO_LAW_ARCHIVE_SHA256) {
    throw new Error(
      `SHA-256 arsip tidak cocok dengan snapshot resmi yang dipatok (${archiveSha256}).`,
    );
  }
  const archiveBytes = statSync(archivePath).size;
  const extractRoot = join(destination, '_extract');
  rmSync(extractRoot, { recursive: true, force: true });
  extractArchive(archivePath, extractRoot);

  const extractedDirectory = join(extractRoot, `indo-law-${commit}`);
  const extractedDataset = join(extractedDirectory, 'dataset');
  if (!existsSync(extractedDataset)) {
    throw new Error(`dataset tidak ditemukan dalam arsip: ${extractedDataset}`);
  }

  rmSync(datasetRoot, { recursive: true, force: true });
  renameSync(extractedDataset, datasetRoot);
  rmSync(extractRoot, { recursive: true, force: true });

  const manifest = buildManifestFromDataset(datasetRoot, {
    repository: INDO_LAW_REPOSITORY,
    commit,
    datasetTree: INDO_LAW_DATASET_TREE,
    archiveUrl: INDO_LAW_ARCHIVE_URL,
    archiveSha256,
    archiveBytes,
    downloadedAt: new Date().toISOString(),
  });

  if (manifest.extraction.fileCount !== INDO_LAW_FILE_COUNT) {
    throw new Error(
      `jumlah XML tidak cocok dengan snapshot resmi (${manifest.extraction.fileCount}).`,
    );
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return {
    destination,
    datasetRoot,
    manifestPath,
    manifest,
    downloaded,
  };
}
