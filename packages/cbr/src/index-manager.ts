/**
 * Case-base index lifecycle.
 *
 * A ready index is only published when its snapshot generation and
 * configuration fingerprint still match the source after the build finishes.
 * A change during a rebuild makes the result stale, so it is discarded and
 * retried. A failed rebuild publishes nothing and estimates are withheld; a
 * stale index is never served as if it were current.
 */

import {
  resolveRetrievalConfig,
  retrievalConfigFingerprint,
  validateRetrievalConfig,
  type RetrievalConfig,
} from './config';
import type {
  CaseBaseSnapshotSource,
  EstimateResult,
  EstimateRequest,
} from './contracts';
import { buildRetrievalIndex, type RetrievalIndex } from './retrieval-index';
import { estimateWithIndex, withheldForUnavailableIndex } from './retrieve';

export type IndexStaleReason =
  | 'NOT_BUILT'
  | 'GENERATION_CHANGED'
  | 'CONFIG_CHANGED';

export type IndexManagerStatus =
  | {
      status: 'ready';
      generation: number;
      configFingerprint: string;
      caseCount: number;
      eligibleCaseCount: number;
      termCount: number;
      buildDurationMs: number;
      builtAt: string;
    }
  | {
      status: 'stale';
      reason: IndexStaleReason;
      currentGeneration: number | null;
      indexGeneration: number | null;
    }
  | {
      status: 'building';
      targetGeneration: number | null;
      startedAt: string;
    }
  | {
      status: 'failed';
      message: string;
      generation: number | null;
      failedAt: string;
    };

export type EnsureIndexResult =
  | { status: 'ready'; index: RetrievalIndex }
  | { status: 'failed'; message: string; generation: number | null };

export interface IndexManagerOptions {
  source: CaseBaseSnapshotSource;
  /**
   * Explicit config wins over the source. When omitted, the source's
   * `loadConfig` (if any) is used and refreshed before each rebuild.
   */
  config?: RetrievalConfig;
  /** Alternative read-only config provider; ignored when `config` is given. */
  configSource?: () => RetrievalConfig;
  /** Rebuild attempts when the generation/config keeps changing. */
  maxAttempts?: number;
  now?: () => number;
  /** Injection point for tests and instrumentation. */
  buildIndex?: typeof buildRetrievalIndex;
}

interface ReadyState {
  index: RetrievalIndex;
  generation: number;
  fingerprint: string;
  builtAt: string;
}

interface FailureState {
  message: string;
  generation: number | null;
  failedAt: string;
}

interface BuildingState {
  targetGeneration: number | null;
  startedAt: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class CaseBaseIndexManager {
  private readonly source: CaseBaseSnapshotSource;
  private readonly maxAttempts: number;
  private readonly now: () => number;
  private readonly buildIndex: typeof buildRetrievalIndex;

  private config: RetrievalConfig;
  private configFingerprint: string;
  /** Read-only persisted config provider; null when config is explicit. */
  private readonly configSource: (() => RetrievalConfig) | null;
  private ready: ReadyState | null = null;
  private lastFailure: FailureState | null = null;
  private building: BuildingState | null = null;
  private pending: Promise<EnsureIndexResult> | null = null;
  /** Invalidates an in-flight rebuild after an explicit change. */
  private epoch = 0;

  constructor(options: IndexManagerOptions) {
    this.source = options.source;
    this.maxAttempts = Math.max(1, Math.trunc(options.maxAttempts ?? 3));
    this.now = options.now ?? Date.now;
    this.buildIndex = options.buildIndex ?? buildRetrievalIndex;
    const sourceLoadConfig = options.source.loadConfig;
    this.configSource =
      options.config === undefined
        ? (options.configSource ??
          (sourceLoadConfig === undefined
            ? null
            : () => sourceLoadConfig.call(options.source)))
        : null;
    this.config =
      options.config ?? this.configSource?.() ?? resolveRetrievalConfig();
    validateRetrievalConfig(this.config);
    this.configFingerprint = retrievalConfigFingerprint(this.config);
  }

  getConfig(): RetrievalConfig {
    return this.config;
  }

  getConfigFingerprint(): string {
    return this.configFingerprint;
  }

  /**
   * Change the in-memory config. When the source provides `loadConfig`, the
   * persisted config is authoritative at the next rebuild.
   */
  setConfig(config: RetrievalConfig): void {
    validateRetrievalConfig(config);
    const fingerprint = retrievalConfigFingerprint(config);
    if (fingerprint === this.configFingerprint) {
      return;
    }
    this.config = config;
    this.configFingerprint = fingerprint;
    this.epoch += 1;
    this.ready = null;
  }

  /** Force the next estimate to rebuild even if the generation is unchanged. */
  invalidate(): void {
    this.epoch += 1;
    this.ready = null;
    this.lastFailure = null;
  }

  private currentGeneration(): number | null {
    try {
      return this.source.getGeneration();
    } catch {
      return null;
    }
  }

  private matchesSource(): boolean {
    if (this.ready === null) {
      return false;
    }
    if (this.ready.fingerprint !== this.configFingerprint) {
      return false;
    }
    const generation = this.currentGeneration();
    return generation !== null && generation === this.ready.generation;
  }

  getStatus(): IndexManagerStatus {
    if (this.building !== null) {
      return {
        status: 'building',
        targetGeneration: this.building.targetGeneration,
        startedAt: this.building.startedAt,
      };
    }

    if (this.matchesSource()) {
      const ready = this.ready;
      if (ready !== null) {
        return {
          status: 'ready',
          generation: ready.generation,
          configFingerprint: ready.fingerprint,
          caseCount: ready.index.cases.length + ready.index.excludedCaseCount,
          eligibleCaseCount: ready.index.eligibleCaseCount,
          termCount: ready.index.termCount,
          buildDurationMs: ready.index.buildDurationMs,
          builtAt: ready.builtAt,
        };
      }
    }

    if (this.lastFailure !== null) {
      return {
        status: 'failed',
        message: this.lastFailure.message,
        generation: this.lastFailure.generation,
        failedAt: this.lastFailure.failedAt,
      };
    }

    const currentGeneration = this.currentGeneration();
    if (currentGeneration === null) {
      return {
        status: 'failed',
        message: 'Generasi basis kasus tidak dapat dibaca.',
        generation: null,
        failedAt: new Date(this.now()).toISOString(),
      };
    }

    if (this.ready === null) {
      return {
        status: 'stale',
        reason: 'NOT_BUILT',
        currentGeneration,
        indexGeneration: null,
      };
    }
    return {
      status: 'stale',
      reason:
        this.ready.fingerprint !== this.configFingerprint
          ? 'CONFIG_CHANGED'
          : 'GENERATION_CHANGED',
      currentGeneration,
      indexGeneration: this.ready.generation,
    };
  }

  /** Return the index only when it still matches the source and config. */
  getReadyIndex(): RetrievalIndex | null {
    const ready = this.ready;
    return ready !== null && this.matchesSource() ? ready.index : null;
  }

  private readyResult(): EnsureIndexResult | null {
    const ready = this.ready;
    if (ready === null || !this.matchesSource()) {
      return null;
    }
    return { status: 'ready', index: ready.index };
  }

  private failure(
    message: string,
    generation: number | null,
  ): Extract<EnsureIndexResult, { status: 'failed' }> {
    this.ready = null;
    this.lastFailure = {
      message,
      generation,
      failedAt: new Date(this.now()).toISOString(),
    };
    this.building = null;
    return { status: 'failed', message, generation };
  }

  /**
   * Pick up a persisted configuration change before a rebuild. The app_config
   * trigger advances the generation, so an old index is already stale; this
   * makes the replacement index use the new configuration.
   */
  private refreshConfigFromSource(): void {
    if (this.configSource === null) {
      return;
    }
    const config = this.configSource();
    validateRetrievalConfig(config);
    const fingerprint = retrievalConfigFingerprint(config);
    if (fingerprint === this.configFingerprint) {
      return;
    }
    this.config = config;
    this.configFingerprint = fingerprint;
  }

  private async rebuildOnce(): Promise<EnsureIndexResult | { status: 'stale' }> {
    this.refreshConfigFromSource();
    const startedAt = this.now();
    const capturedEpoch = this.epoch;
    const targetGeneration = this.currentGeneration();
    const targetFingerprint = this.configFingerprint;
    this.building = {
      targetGeneration,
      startedAt: new Date(startedAt).toISOString(),
    };

    try {
      const snapshot = this.source.loadSnapshot();
      const index = this.buildIndex(snapshot.cases, this.config, {
        generation: snapshot.generation,
        now: this.now,
      });

      const afterGeneration = this.source.getGeneration();
      const afterFingerprint = this.configFingerprint;
      if (
        capturedEpoch !== this.epoch ||
        afterFingerprint !== targetFingerprint ||
        afterGeneration !== snapshot.generation
      ) {
        this.building = null;
        return { status: 'stale' };
      }

      this.ready = {
        index,
        generation: snapshot.generation,
        fingerprint: targetFingerprint,
        builtAt: new Date(this.now()).toISOString(),
      };
      this.lastFailure = null;
      this.building = null;
      return { status: 'ready', index };
    } catch (error) {
      return this.failure(errorMessage(error), targetGeneration);
    }
  }

  private async runRebuild(): Promise<EnsureIndexResult> {
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      const result = await this.rebuildOnce();
      if (result.status === 'failed') {
        return result;
      }
      if (result.status === 'ready' && this.matchesSource()) {
        return result;
      }
      // The case base or configuration changed during the build. Discard the
      // result and try again; the stale index is not published.
    }
    return this.failure(
      'Basis kasus atau konfigurasi berubah selama pembangunan indeks; indeks yang cocok belum siap.',
      this.currentGeneration(),
    );
  }

  private async ensureReady(): Promise<EnsureIndexResult> {
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      const alreadyReady = this.readyResult();
      if (alreadyReady !== null) {
        return alreadyReady;
      }

      // Never keep serving an old index while a replacement is being built.
      this.ready = null;

      if (this.pending === null) {
        this.pending = this.runRebuild().finally(() => {
          this.pending = null;
        });
      }

      const result = await this.pending;
      if (result.status === 'failed') {
        return result;
      }
      const ready = this.readyResult();
      if (ready !== null) {
        return ready;
      }
    }

    const failure = this.lastFailure as FailureState | null;
    return {
      status: 'failed',
      message:
        failure?.message ??
        'Basis kasus berubah terus selama pembangunan indeks; estimasi ditahan.',
      generation: this.currentGeneration(),
    };
  }

  /** Rebuild if needed; safe to call at startup. */
  async warm(): Promise<IndexManagerStatus> {
    await this.ensureReady();
    return this.getStatus();
  }

  /**
   * Wait for a matching index, then estimate. If the index cannot be built the
   * result is withheld with `INDEKS_GAGAL_DIBANGUN`; the previous index is not
   * used as a fallback.
   */
  async estimate(
    request: EstimateRequest,
  ): Promise<EstimateResult> {
    const ensured = await this.ensureReady();
    if (ensured.status === 'failed') {
      return withheldForUnavailableIndex({
        code: 'INDEKS_GAGAL_DIBANGUN',
        message: `Indeks basis kasus belum siap: ${ensured.message}`,
        caseBaseGeneration: ensured.generation,
        configFingerprint: this.configFingerprint,
        config: this.config,
        details: { engineStatus: 'failed' },
      });
    }
    return estimateWithIndex(ensured.index, request);
  }
}
