import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { retrievalConfigFingerprint } from '@cbr/core';
import {
  closeDatabase,
  createCaseUnit,
  openDatabase,
  runMigrations,
} from '@cbr/data';
import {
  BenchmarkError,
  runBenchmark,
  summarizeLatencies,
  SEARCH_LATENCY_TARGET_MS,
} from './benchmark';

let directory: string;
let database: string;

const NARRATIONS = [
  'terdakwa mengambil sepeda motor milik korban di depan pasar pada malam hari',
  'terdakwa mengambil sepeda motor korban yang terparkir di halaman rumah',
  'terdakwa membawa kabur sepeda motor milik korban dengan kunci palsu',
  'terdakwa mengambil barang berupa sepeda motor milik korban tanpa izin',
  'terdakwa memukul korban hingga luka ringan di depan rumah',
  'terdakwa menganiaya korban dengan tangan hingga mengalami luka',
];

function seedCases(): void {
  const db = openDatabase(database);
  try {
    runMigrations(db);
    let counter = 0;
    const nextId = () => `synthetic-${String(counter++).padStart(3, '0')}`;
    for (let index = 0; index < NARRATIONS.length; index += 1) {
      createCaseUnit(
        db,
        {
          court: 'PN Sintetis',
          caseNumber: `${index + 1}/Pid.B/2024/PN.Sintetis`,
          narration: NARRATIONS[index] as string,
          category: index < 4 ? 'pencurian' : 'penganiayaan',
          actualSentenceDays: 120 + index * 30,
          attributes: {
            gender: { type: 'enum', value: 'laki-laki' },
            role: { type: 'enum', value: 'pelaku' },
          },
        },
        nextId,
      );
    }
  } finally {
    closeDatabase(db);
  }
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cbr-benchmark-'));
  database = join(directory, 'app.db');
  seedCases();
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe('summarizeLatencies', () => {
  it('returns zeros for an empty sample', () => {
    expect(summarizeLatencies([])).toEqual({
      count: 0,
      totalMs: 0,
      minMs: 0,
      meanMs: 0,
      p50Ms: 0,
      p90Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      maxMs: 0,
    });
  });

  it('summarizes a sorted and unsorted sample with nearest-rank percentiles', () => {
    const summary = summarizeLatencies([4, 1, 3, 2]);

    expect(summary.count).toBe(4);
    expect(summary.totalMs).toBe(10);
    expect(summary.minMs).toBe(1);
    expect(summary.meanMs).toBe(2.5);
    expect(summary.p50Ms).toBe(2);
    expect(summary.p90Ms).toBe(4);
    expect(summary.p95Ms).toBe(4);
    expect(summary.p99Ms).toBe(4);
    expect(summary.maxMs).toBe(4);
  });
});

describe('runBenchmark', () => {
  it('measures startup and search separately against the imported cases', () => {
    const report = runBenchmark({
      databasePath: database,
      queryLimit: 4,
      warmupCount: 1,
    });

    expect(report.schemaVersion).toBe(1);
    expect(report.dataset).toMatchObject({
      databasePath: database,
      caseCount: 6,
      eligibleCaseCount: 6,
      excludedCaseCount: 0,
      categoryCount: 2,
    });
    expect(report.dataset.generation).toBeGreaterThan(0);
    expect(report.dataset.termCount).toBeGreaterThan(0);
    expect(report.dataset.databaseMainBytes).toBeGreaterThan(0);

    expect(report.configuration.fingerprint).toBe(
      retrievalConfigFingerprint(report.configuration.config),
    );
    expect(report.dataset.indexConfigFingerprint).toBe(
      report.configuration.fingerprint,
    );

    expect(report.phases.databaseOpenMs).toBeGreaterThanOrEqual(0);
    expect(report.phases.snapshotLoadMs).toBeGreaterThanOrEqual(0);
    expect(report.phases.indexBuildMs).toBeGreaterThanOrEqual(0);
    expect(report.phases.totalStartupMs).toBeGreaterThanOrEqual(
      report.phases.indexBuildMs,
    );

    expect(report.queries).toMatchObject({
      requestedCount: 4,
      selectedCount: 4,
      warmupCount: 1,
      excludeQueryCase: true,
    });
    expect(report.queries.estimatedCount + report.queries.withheldCount).toBe(4);
    expect(report.latency.count).toBe(4);
    expect(report.latency.minMs).toBeGreaterThanOrEqual(0);
    expect(report.latency.maxMs).toBeGreaterThanOrEqual(report.latency.minMs);
    expect(report.latency.p50Ms).toBeGreaterThanOrEqual(report.latency.minMs);
    expect(report.latency.p99Ms).toBeLessThanOrEqual(report.latency.maxMs);

    expect(report.target).toMatchObject({
      searchLatencyMs: SEARCH_LATENCY_TARGET_MS,
      appliedTo: 'max-search-latency',
      evaluated: true,
    });
    expect(typeof report.target.met).toBe('boolean');

    expect(report.machine.nodeVersion).toBe(process.version);
    expect(report.machine.cpuCount).toBeGreaterThan(0);
    expect(report.memory.baseline.rssBytes).toBeGreaterThan(0);
    expect(report.memory.afterIndexBuild.rssBytes).toBeGreaterThan(0);
    expect(report.memory.afterSearch.rssBytes).toBeGreaterThan(0);
  });

  it('uses every eligible case when the limit exceeds the case base', () => {
    const report = runBenchmark({
      databasePath: database,
      queryLimit: 500,
      warmupCount: 0,
    });

    expect(report.queries.requestedCount).toBe(500);
    expect(report.queries.selectedCount).toBe(6);
    expect(report.latency.count).toBe(6);
  });

  it('reports an unevaluated target when no case is eligible', () => {
    const emptyDirectory = mkdtempSync(join(tmpdir(), 'cbr-benchmark-empty-'));
    const emptyDatabase = join(emptyDirectory, 'empty.db');
    const db = openDatabase(emptyDatabase);
    try {
      runMigrations(db);
    } finally {
      closeDatabase(db);
    }

    try {
      const report = runBenchmark({
        databasePath: emptyDatabase,
        queryLimit: 10,
        warmupCount: 0,
      });

      expect(report.dataset.caseCount).toBe(0);
      expect(report.queries.selectedCount).toBe(0);
      expect(report.latency.count).toBe(0);
      expect(report.target.evaluated).toBe(false);
      expect(report.target.met).toBe(false);
      expect(report.target.p95Met).toBe(false);
    } finally {
      rmSync(emptyDirectory, { recursive: true, force: true });
    }
  });

  it('rejects a missing database and invalid limits', () => {
    expect(() =>
      runBenchmark({ databasePath: join(directory, 'missing.db') }),
    ).toThrow(BenchmarkError);

    expect(() =>
      runBenchmark({ databasePath: database, queryLimit: 0 }),
    ).toThrow(BenchmarkError);

    expect(() =>
      runBenchmark({ databasePath: database, warmupCount: -1 }),
    ).toThrow(BenchmarkError);
  });
});
