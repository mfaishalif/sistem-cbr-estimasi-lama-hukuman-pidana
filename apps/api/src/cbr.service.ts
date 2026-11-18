import { Injectable, Logger } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import {
  CaseBaseIndexManager,
  type EstimateRequest,
  type EstimateResult,
  type IndexManagerStatus,
  type RetrievalConfig,
} from '@cbr/core';
import { SqliteCaseBaseSource } from '@cbr/data';
import { DatabaseService } from './database.service';
import { RetrievalConfigService } from './retrieval-config.service';

/**
 * Owns the process-wide derived index. CRUD invalidates it; the next estimate
 * rebuilds from a consistent snapshot. A failed or building index is reported
 * explicitly instead of serving stale data.
 */
@Injectable()
export class CbrService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CbrService.name);
  private readonly manager: CaseBaseIndexManager;

  constructor(
    database: DatabaseService,
    private readonly retrievalConfig: RetrievalConfigService,
  ) {
    this.manager = new CaseBaseIndexManager({
      source: new SqliteCaseBaseSource(database.database),
    });
  }

  onApplicationBootstrap(): void {
    // Do not block HTTP startup while a large case base is indexed. The status
    // endpoint exposes the build, and an estimate waits for the same promise.
    void this.manager
      .warm()
      .then((status) => {
        if (status.status === 'ready') {
          this.logger.log(
            `Indeks siap: ${status.eligibleCaseCount}/${status.caseCount} unit layak, ` +
              `generasi ${status.generation}, ${status.buildDurationMs} ms.`,
          );
        } else {
          this.logger.warn(`Indeks belum siap: ${JSON.stringify(status)}`);
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Pembangunan indeks gagal saat startup: ${message}`);
      });
  }

  status(): {
    index: IndexManagerStatus;
    configFingerprint: string;
    configSource: string;
  } {
    return {
      index: this.manager.getStatus(),
      configFingerprint: this.retrievalConfig.get().fingerprint,
      configSource: this.retrievalConfig.get().displayPath,
    };
  }

  config(): RetrievalConfig {
    return this.retrievalConfig.getConfig();
  }

  /** Mark the current index stale after a write. */
  invalidate(): void {
    this.manager.invalidate();
  }

  estimate(request: EstimateRequest): Promise<EstimateResult> {
    return this.manager.estimate(request);
  }
}
