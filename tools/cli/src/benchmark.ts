/**
 * Retrieve–Reuse search benchmark.
 *
 * This harness measures three separate things against an imported case base:
 * snapshot loading, index construction, and per-query search latency with a
 * ready index. Startup and rebuild time are never folded into the search
 * numbers. It also records the machine, data, and configuration so a reported
 * latency can be reproduced.
 *
 * Speed is not accuracy. The query cases are eligible historical cases used
 * with their own outcome withheld, so this measures retrieval cost only. The
 * final weights and thresholds are still owned by the evaluation ticket.
 */

import { existsSync, statSync } from 'node:fs';
import {
  arch,
  cpus,
  freemem,
  platform,
  release,
  totalmem,
} from 'node:os';
import { performance } from 'node:perf_hooks';
import {
  buildRetrievalIndex,
  estimateWithIndex,
  retrievalConfigFingerprint,
  type RetrievalConfig,
  type RetrievalIndex,
  type WithholdingCode,
} from '@cbr/core';
import {
  closeDatabase,
  loadCaseBaseSnapshot,
  loadRetrievalConfig,
  openDatabase,
} from '@cbr/data';

/** The ticket's latency target for one search with a ready index. */
export const SEARCH_LATENCY_TARGET_MS = 2_000;

const DEFAULT_QUERY_LIMIT = 200;
const DEFAULT_WARMUP_QUERIES = 5;

export interface LatencySummary {
  count: number;
  totalMs: number;
  minMs: number;
  meanMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

export interface MemorySnapshot {
  rssBytes: number;
  heapTotalBytes: number;
  heapUsedBytes: number;
  externalBytes: number;
  arrayBuffersBytes: number;
}

export interface BenchmarkPhaseDurations {
  databaseOpenMs: number;
  configLoadMs: number;
  snapshotLoadMs: number;
  databaseCloseMs: number;
  indexBuildMs: number;
  /** Everything from database open through index build. */
  totalStartupMs: number;
}

export interface BenchmarkReport {
  schemaVersion: 1;
  createdAt: string;
  target: {
    searchLatencyMs: number;
    appliedTo: 'max-search-latency';
    evaluated: boolean;
    met: boolean;
    p95Met: boolean;
  };
  machine: {
    platform: string;
    arch: string;
    release: string;
    nodeVersion: string;
    cpuModel: string | null;
    cpuCount: number;
    totalMemoryBytes: number;
    freeMemoryBytes: number;
  };
  dataset: {
    databasePath: string;
    databaseMainBytes: number;
    databaseWalBytes: number;
    databaseTotalBytes: number;
    generation: number;
    caseCount: number;
    eligibleCaseCount: number;
    excludedCaseCount: number;
    categoryCount: number;
    termCount: number;
    indexConfigFingerprint: string;
  };
  configuration: {
    fingerprint: string;
    config: RetrievalConfig;
  };
  phases: BenchmarkPhaseDurations;
  memory: {
    baseline: MemorySnapshot;
    afterSnapshotLoad: MemorySnapshot;
    afterIndexBuild: MemorySnapshot;
    afterSearch: MemorySnapshot;
    /** RSS growth caused by building the index from the loaded snapshot. */
    indexBuildRssDeltaBytes: number;
    /** RSS growth caused by the measured search loop. */
    searchRssDeltaBytes: number;
  };
  queries: {
    selection: 'evenly-spaced-eligible-cases';
    excludeQueryCase: true;
    requestedCount: number;
    selectedCount: number;
    warmupCount: number;
    estimatedCount: number;
    withheldCount: number;
    withheldByCode: Partial<Record<WithholdingCode, number>>;
  };
  latency: LatencySummary;
  notes: readonly string[];
}

export interface RunBenchmarkOptions {
  databasePath: string;
  /** Override the persisted retrieval configuration. */
  config?: RetrievalConfig;
  /** Number of evenly spaced eligible cases to use as queries. */
  queryLimit?: number;
  /** Unmeasured searches before the measured loop. */
  warmupCount?: number;
  now?: () => number;
}

export class BenchmarkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BenchmarkError';
  }
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function memorySnapshot(): MemorySnapshot {
  const usage = process.memoryUsage();
  return {
    rssBytes: usage.rss,
    heapTotalBytes: usage.heapTotal,
    heapUsedBytes: usage.heapUsed,
    externalBytes: usage.external,
    arrayBuffersBytes: usage.arrayBuffers,
  };
}

/** Nearest-rank percentile. Returns 0 for an empty sample. */
function percentile(sortedAscending: readonly number[], percentileValue: number): number {
  if (sortedAscending.length === 0) {
    return 0;
  }
  const rank = Math.ceil((percentileValue / 100) * sortedAscending.length);
  const index = Math.min(sortedAscending.length - 1, Math.max(0, rank - 1));
  return sortedAscending[index] as number;
}

/** Summarize per-query durations in milliseconds. */
export function summarizeLatencies(samples: readonly number[]): LatencySummary {
  if (samples.length === 0) {
    return {
      count: 0,
      totalMs: 0,
      minMs: 0,
      meanMs: 0,
      p50Ms: 0,
      p90Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      maxMs: 0,
    };
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const total = samples.reduce((sum, value) => sum + value, 0);
  return {
    count: samples.length,
    totalMs: round(total),
    minMs: round(sorted[0] as number),
    meanMs: round(total / samples.length),
    p50Ms: round(percentile(sorted, 50)),
    p90Ms: round(percentile(sorted, 90)),
    p95Ms: round(percentile(sorted, 95)),
    p99Ms: round(percentile(sorted, 99)),
    maxMs: round(sorted[sorted.length - 1] as number),
  };
}

function evenlySpaced(total: number, limit: number): number[] {
  const count = Math.min(limit, total);
  if (count <= 0) {
    return [];
  }
  if (count === total) {
    return Array.from({ length: total }, (_, index) => index);
  }
  return Array.from({ length: count }, (_, position) =>
    Math.floor((position * total) / count),
  );
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new BenchmarkError(`${label} harus bilangan bulat positif.`);
  }
  return value;
}

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BenchmarkError(`${label} harus bilangan bulat nol atau positif.`);
  }
  return value;
}

function fileBytes(path: string): number {
  return existsSync(path) ? statSync(path).size : 0;
}

function searchOnce(index: RetrievalIndex, caseIndex: number) {
  const query = index.cases[caseIndex];
  if (query === undefined) {
    throw new BenchmarkError(`Indeks kasus tidak memiliki posisi ${caseIndex}.`);
  }
  return estimateWithIndex(index, {
    facts: query.facts,
    excludeCaseUnitIds: [query.id],
  });
}

/**
 * Run the benchmark synchronously so the CLI keeps its simple exit-code
 * contract. The database is closed before the index is built and searched, so
 * search latency cannot accidentally include SQLite reads.
 */
export function runBenchmark(options: RunBenchmarkOptions): BenchmarkReport {
  const databasePath = options.databasePath;
  if (!existsSync(databasePath)) {
    throw new BenchmarkError(`Basis data tidak ditemukan: ${databasePath}`);
  }

  const queryLimit = positiveInteger(
    options.queryLimit ?? DEFAULT_QUERY_LIMIT,
    'queryLimit',
  );
  const warmupCount = nonNegativeInteger(
    options.warmupCount ?? DEFAULT_WARMUP_QUERIES,
    'warmupCount',
  );
  const now = options.now ?? Date.now;
  const clock = () => performance.now();

  const baselineMemory = memorySnapshot();
  const startupStart = clock();

  const openStart = clock();
  const db = openDatabase(databasePath);
  const openEnd = clock();

  let config!: RetrievalConfig;
  let snapshot!: ReturnType<typeof loadCaseBaseSnapshot>;
  let configLoadMs = 0;
  let snapshotLoadMs = 0;
  let closeDurationMs = 0;
  try {
    const configStart = clock();
    config = options.config ?? loadRetrievalConfig(db);
    configLoadMs = clock() - configStart;

    const snapshotStart = clock();
    snapshot = loadCaseBaseSnapshot(db);
    snapshotLoadMs = clock() - snapshotStart;
  } finally {
    const closeStart = clock();
    closeDatabase(db);
    closeDurationMs = clock() - closeStart;
  }
  const afterSnapshotMemory = memorySnapshot();

  const buildStart = clock();
  const index = buildRetrievalIndex(snapshot.cases, config, {
    generation: snapshot.generation,
    now,
  });
  const buildEnd = clock();
  const afterBuildMemory = memorySnapshot();

  const queryIndices = evenlySpaced(index.cases.length, queryLimit);
  const effectiveWarmup = Math.min(warmupCount, queryIndices.length);

  for (let position = 0; position < effectiveWarmup; position += 1) {
    searchOnce(index, queryIndices[position] as number);
  }

  const samples: number[] = [];
  const withheldByCode: Partial<Record<WithholdingCode, number>> = {};
  let estimatedCount = 0;
  let withheldCount = 0;

  for (const caseIndex of queryIndices) {
    const startedAt = clock();
    const result = searchOnce(index, caseIndex);
    const finishedAt = clock();
    samples.push(finishedAt - startedAt);

    if (result.status === 'estimated') {
      estimatedCount += 1;
    } else {
      withheldCount += 1;
      const code = result.withholding?.code;
      if (code !== undefined) {
        withheldByCode[code] = (withheldByCode[code] ?? 0) + 1;
      }
    }
  }

  const afterSearchMemory = memorySnapshot();
  const latency = summarizeLatencies(samples);
  const configFingerprint = retrievalConfigFingerprint(config);
  const mainBytes = fileBytes(databasePath);
  const walBytes = fileBytes(`${databasePath}-wal`);
  const cpu = cpus()[0];

  return {
    schemaVersion: 1,
    createdAt: new Date(now()).toISOString(),
    target: {
      searchLatencyMs: SEARCH_LATENCY_TARGET_MS,
      appliedTo: 'max-search-latency',
      evaluated: latency.count > 0,
      met: latency.count > 0 && latency.maxMs <= SEARCH_LATENCY_TARGET_MS,
      p95Met: latency.count > 0 && latency.p95Ms <= SEARCH_LATENCY_TARGET_MS,
    },
    machine: {
      platform: platform(),
      arch: arch(),
      release: release(),
      nodeVersion: process.version,
      cpuModel: cpu?.model ?? null,
      cpuCount: cpus().length,
      totalMemoryBytes: totalmem(),
      freeMemoryBytes: freemem(),
    },
    dataset: {
      databasePath,
      databaseMainBytes: mainBytes,
      databaseWalBytes: walBytes,
      databaseTotalBytes: mainBytes + walBytes,
      generation: snapshot.generation,
      caseCount: snapshot.cases.length,
      eligibleCaseCount: index.eligibleCaseCount,
      excludedCaseCount: index.excludedCaseCount,
      categoryCount: index.categories.size,
      termCount: index.termCount,
      indexConfigFingerprint: index.configFingerprint,
    },
    configuration: {
      fingerprint: configFingerprint,
      config,
    },
    phases: {
      databaseOpenMs: round(openEnd - openStart),
      configLoadMs: round(configLoadMs),
      snapshotLoadMs: round(snapshotLoadMs),
      databaseCloseMs: round(closeDurationMs),
      indexBuildMs: round(buildEnd - buildStart),
      totalStartupMs: round(buildEnd - startupStart),
    },
    memory: {
      baseline: baselineMemory,
      afterSnapshotLoad: afterSnapshotMemory,
      afterIndexBuild: afterBuildMemory,
      afterSearch: afterSearchMemory,
      indexBuildRssDeltaBytes: afterBuildMemory.rssBytes - afterSnapshotMemory.rssBytes,
      searchRssDeltaBytes: afterSearchMemory.rssBytes - afterBuildMemory.rssBytes,
    },
    queries: {
      selection: 'evenly-spaced-eligible-cases',
      excludeQueryCase: true,
      requestedCount: queryLimit,
      selectedCount: queryIndices.length,
      warmupCount: effectiveWarmup,
      estimatedCount,
      withheldCount,
      withheldByCode,
    },
    latency,
    notes: [
      'Target berlaku untuk satu pencarian dengan indeks siap; pembacaan snapshot dan pembangunan indeks dilaporkan terpisah.',
      'Kasus uji berasal dari kasus historis layak dengan hasil aktualnya tidak dipakai sebagai input; ini mengukur kecepatan, bukan akurasi estimasi.',
      'Nilai default Retrieve adalah placeholder; bobot dan ambang akhir mengikuti tiket evaluasi.',
      'Nilai memori adalah snapshot proses dan mencakup runtime Node.js serta cache SQLite.',
    ],
  };
}
