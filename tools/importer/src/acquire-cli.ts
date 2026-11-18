#!/usr/bin/env node
import { acquireIndoLawSnapshot, INDO_LAW_COMMIT } from './acquire';

interface Flags {
  destination: string;
  archive?: string;
  force: boolean;
}

function parse(argv: readonly string[]): Flags {
  const flags: Flags = { destination: 'data/raw/indo-law', force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--destination') {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error('--destination memerlukan nilai');
      }
      flags.destination = value;
      index += 1;
    } else if (argument === '--archive') {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error('--archive memerlukan nilai');
      }
      flags.archive = value;
      index += 1;
    } else if (argument === '--force') {
      flags.force = true;
    } else if (argument === '--help' || argument === '-h') {
      process.stdout.write(
        [
          'Penggunaan: node tools/importer/dist/acquire-cli.js [opsi]',
          '',
          `Mengunduh snapshot resmi Indo-Law pada commit ${INDO_LAW_COMMIT},`,
          'mengekstraknya, dan menulis manifest.json berisi SHA-256 arsip dan tiap XML.',
          '',
          'Opsi:',
          '  --destination <dir>  Folder lokal tujuan. Default: data/raw/indo-law',
          '  --archive <path>     Pakai arsip ZIP yang sudah diunduh.',
          '  --force              Ulangi ekstraksi dan manifest.',
          '',
        ].join('\n'),
      );
      process.exit(0);
    } else {
      throw new Error(`argumen tidak dikenal: ${argument}`);
    }
  }
  return flags;
}

async function main(): Promise<number> {
  try {
    const flags = parse(process.argv.slice(2));
    const result = await acquireIndoLawSnapshot({
      destination: flags.destination,
      archivePath: flags.archive,
      force: flags.force,
    });
    process.stdout.write(
      `${JSON.stringify(
        {
          destination: result.destination,
          datasetRoot: result.datasetRoot,
          manifestPath: result.manifestPath,
          commit: result.manifest.source.commit,
          archiveSha256: result.manifest.source.archiveSha256,
          files: result.manifest.extraction.fileCount,
          bytes: result.manifest.extraction.totalBytes,
          downloaded: result.downloaded,
        },
        null,
        2,
      )}\n`,
    );
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

void main().then((code) => {
  process.exitCode = code;
});
