import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Open a SQLite database with the pragmas this application relies on.
 *
 * `node:sqlite` is part of the pinned Node.js runtime, so the Docker image
 * needs no native module build toolchain.
 */
export function openDatabase(databasePath: string): DatabaseSync {
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  if (databasePath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  return db;
}

export function closeDatabase(db: DatabaseSync): void {
  db.close();
}
