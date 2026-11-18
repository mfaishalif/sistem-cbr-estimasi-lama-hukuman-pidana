import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import {
  closeDatabase,
  getDatabaseStatus,
  openDatabase,
  runMigrations,
  type MigrationResult,
} from '@cbr/data';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly database: DatabaseSync;
  readonly databasePath: string;
  readonly migration: MigrationResult;

  constructor() {
    this.databasePath =
      process.env.DATABASE_PATH ?? join(process.cwd(), 'data', 'app.db');
    this.database = openDatabase(this.databasePath);
    this.migration = runMigrations(this.database);
    this.logger.log(
      `SQLite ready at ${this.databasePath} (schema ${this.migration.schemaVersion ?? 'none'}, applied: ${
        this.migration.applied.length > 0 ? this.migration.applied.join(', ') : 'none'
      })`,
    );
  }

  status() {
    try {
      return getDatabaseStatus(this.database);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Database health check failed: ${message}`);
      throw new ServiceUnavailableException('Database tidak tersedia');
    }
  }

  onApplicationShutdown(): void {
    closeDatabase(this.database);
  }
}
