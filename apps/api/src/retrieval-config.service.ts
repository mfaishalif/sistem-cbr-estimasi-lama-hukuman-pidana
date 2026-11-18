import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import type { RetrievalConfig } from '@cbr/core';
import { retrievalConfigFingerprint, resolveRetrievalConfig } from '@cbr/core';
import {
  RETRIEVAL_CONFIG_KEY,
  getConfig,
  loadRetrievalConfig,
  saveRetrievalConfig,
} from '@cbr/data';
import { DatabaseService } from './database.service';

export interface RetrievalConfigSnapshot {
  config: RetrievalConfig;
  fingerprint: string;
  /** File that seeded the active configuration, or null when using SQLite defaults. */
  sourcePath: string | null;
  /** Path shown in the UI, relative to the working directory when possible. */
  displayPath: string;
  persistedUpdatedAt: string | null;
  persisted: boolean;
}

/**
 * The active retrieval configuration is traceable to a file, not hidden UI
 * numbers. A file wins over the previously persisted value; when no file is
 * mounted, the persisted value or the documented defaults apply.
 */
@Injectable()
export class RetrievalConfigService {
  private readonly logger = new Logger(RetrievalConfigService.name);
  private readonly snapshot: RetrievalConfigSnapshot;

  constructor(private readonly database: DatabaseService) {
    const configuredPath =
      process.env.RETRIEVAL_CONFIG_PATH ?? join(process.cwd(), 'config', 'retrieval.json');
    const sourcePath = isAbsolute(configuredPath)
      ? configuredPath
      : join(process.cwd(), configuredPath);
    const displayPath = isAbsolute(configuredPath)
      ? relative(process.cwd(), configuredPath)
      : configuredPath;

    let config: RetrievalConfig;
    let persisted = false;

    if (existsSync(sourcePath)) {
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(sourcePath, 'utf8'));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Konfigurasi retrieval tidak dapat dibaca dari ${displayPath}: ${message}`);
      }
      config = resolveRetrievalConfig(
        raw as Parameters<typeof resolveRetrievalConfig>[0],
      );

      const existing = getConfig(this.database.database, RETRIEVAL_CONFIG_KEY);
      const existingFingerprint =
        existing === null
          ? null
          : retrievalConfigFingerprint(loadRetrievalConfig(this.database.database));
      const fileFingerprint = retrievalConfigFingerprint(config);
      if (existingFingerprint !== fileFingerprint) {
        saveRetrievalConfig(this.database.database, config);
        persisted = true;
        this.logger.log(
          `Konfigurasi retrieval dari ${displayPath} disimpan ke basis data (${fileFingerprint}).`,
        );
      }
    } else {
      config = loadRetrievalConfig(this.database.database);
      this.logger.warn(
        `Berkas konfigurasi retrieval tidak ditemukan di ${displayPath}; memakai konfigurasi tersimpan/default.`,
      );
    }

    const entry = getConfig(this.database.database, RETRIEVAL_CONFIG_KEY);
    this.snapshot = {
      config,
      fingerprint: retrievalConfigFingerprint(config),
      sourcePath: existsSync(sourcePath) ? sourcePath : null,
      displayPath,
      persistedUpdatedAt: entry?.updatedAt ?? null,
      persisted,
    };
  }

  get(): RetrievalConfigSnapshot {
    return this.snapshot;
  }

  getConfig(): RetrievalConfig {
    return this.snapshot.config;
  }
}
