import { describe, expect, it } from 'vitest';
import {
  CaseBaseIndexManager,
  buildRetrievalIndex,
  resolveRetrievalConfig,
} from '../src';
import type {
  CaseBaseCase,
  CaseBaseSnapshot,
  CaseBaseSnapshotSource,
} from '../src';
import { fixtureCase } from './fixtures';

class MutableSource implements CaseBaseSnapshotSource {
  cases: CaseBaseCase[];
  generation = 1;
  loadCount = 0;
  onLoad?: (source: MutableSource) => void;
  failGeneration = false;

  constructor(cases: CaseBaseCase[]) {
    this.cases = cases;
  }

  getGeneration(): number {
    if (this.failGeneration) {
      throw new Error('database unavailable');
    }
    return this.generation;
  }

  loadSnapshot(): CaseBaseSnapshot {
    const generation = this.generation;
    this.loadCount += 1;
    this.onLoad?.(this);
    return { generation, cases: [...this.cases] };
  }

  add(candidate: CaseBaseCase): void {
    this.cases = [...this.cases, candidate];
    this.generation += 1;
  }

  remove(id: string): void {
    this.cases = this.cases.filter((candidate) => candidate.id !== id);
    this.generation += 1;
  }

  updateOutcome(id: string, actualSentenceDays: number): void {
    this.cases = this.cases.map((candidate) =>
      candidate.id === id
        ? { ...candidate, outcome: { actualSentenceDays } }
        : candidate,
    );
    this.generation += 1;
  }
}

const narrative = 'terdakwa mengambil sepeda motor milik korban';

function query() {
  return { facts: { narration: narrative } };
}

describe('case-base index manager', () => {
  it('rebuilds automatically after an add/Retain and never serves the old index', async () => {
    const source = new MutableSource([fixtureCase({ id: 'A' })]);
    const manager = new CaseBaseIndexManager({ source });

    await manager.warm();
    expect(manager.getStatus()).toMatchObject({ status: 'ready', generation: 1 });

    source.add(fixtureCase({ id: 'B' }));
    expect(manager.getStatus()).toMatchObject({
      status: 'stale',
      reason: 'GENERATION_CHANGED',
      currentGeneration: 2,
      indexGeneration: 1,
    });
    expect(manager.getReadyIndex()).toBeNull();

    const result = await manager.estimate(query());
    expect(result.status).toBe('estimated');
    expect(result.caseBaseGeneration).toBe(2);
    expect(result.references.map((reference) => reference.caseUnitId)).toEqual([
      'A',
      'B',
    ]);
  });

  it('uses an edited actual outcome for new predictions after the index is ready', async () => {
    const source = new MutableSource([
      fixtureCase({ id: 'A', outcomeDays: 100 }),
    ]);
    const manager = new CaseBaseIndexManager({ source });

    expect((await manager.estimate(query())).estimate.days).toBe(100);

    source.updateOutcome('A', 240);
    const afterEdit = await manager.estimate(query());
    expect(afterEdit.caseBaseGeneration).toBe(2);
    expect(afterEdit.estimate.days).toBe(240);
  });

  it('stops using a deleted case as a reference', async () => {
    const source = new MutableSource([
      fixtureCase({ id: 'A', outcomeDays: 100 }),
      fixtureCase({ id: 'B', outcomeDays: 900 }),
    ]);
    const manager = new CaseBaseIndexManager({ source });
    await manager.warm();
    expect(
      (await manager.estimate(query())).references.map((reference) => reference.caseUnitId),
    ).toEqual(['A', 'B']);

    source.remove('B');
    const afterDelete = await manager.estimate(query());
    expect(afterDelete.caseBaseGeneration).toBe(2);
    expect(afterDelete.references.map((reference) => reference.caseUnitId)).toEqual([
      'A',
    ]);
    expect(afterDelete.estimate.days).toBe(100);
  });

  it('discards a build when the case base changes during the rebuild', async () => {
    const source = new MutableSource([fixtureCase({ id: 'A' })]);
    let changed = false;
    const manager = new CaseBaseIndexManager({
      source,
      buildIndex: (cases, config, options) => {
        const index = buildRetrievalIndex(cases, config, options);
        if (!changed) {
          changed = true;
          source.add(fixtureCase({ id: 'C' }));
        }
        return index;
      },
    });

    const status = await manager.warm();
    expect(status).toMatchObject({
      status: 'ready',
      generation: 2,
      eligibleCaseCount: 2,
    });
    expect(manager.getReadyIndex()?.cases.map((candidate) => candidate.id)).toEqual([
      'A',
      'C',
    ]);
    // The first snapshot was built and discarded; the second one was published.
    expect(source.loadCount).toBe(2);
  });

  it('discards a build when the configuration changes during the rebuild', async () => {
    const source = new MutableSource([fixtureCase({ id: 'A' })]);
    const narrower = resolveRetrievalConfig({
      retrieval: { maxReferences: 1 },
      components: { attributes: [] },
    });
    let changed = false;
    const manager = new CaseBaseIndexManager({
      source,
      buildIndex: (cases, config, options) => {
        const index = buildRetrievalIndex(cases, config, options);
        if (!changed) {
          changed = true;
          manager.setConfig(narrower);
        }
        return index;
      },
    });

    const status = await manager.warm();
    expect(status.status).toBe('ready');
    if (status.status === 'ready') {
      expect(status.configFingerprint).toBe(manager.getConfigFingerprint());
    }
    const result = await manager.estimate(query());
    expect(result.scoring.maxReferences).toBe(1);
  });

  it('withholds on a failed rebuild and does not fall back to the stale index', async () => {
    const source = new MutableSource([fixtureCase({ id: 'A' })]);
    let failNext = false;
    const manager = new CaseBaseIndexManager({
      source,
      buildIndex: (cases, config, options) => {
        if (failNext) {
          failNext = false;
          throw new Error('index build exploded');
        }
        return buildRetrievalIndex(cases, config, options);
      },
    });

    await manager.warm();
    source.add(fixtureCase({ id: 'B' }));
    failNext = true;

    const failed = await manager.estimate(query());
    expect(failed.status).toBe('withheld');
    expect(failed.withholding?.code).toBe('INDEKS_GAGAL_DIBANGUN');
    expect(failed.references).toEqual([]);
    expect(failed.estimate.days).toBeNull();
    expect(failed.scoring.maxReferences).toBe(5);
    expect(failed.scoring.narrativeWeight).toBe(1);
    expect(failed.scoring.configuredAttributeWeight).toBeGreaterThan(0);
    expect(manager.getReadyIndex()).toBeNull();
    expect(manager.getStatus()).toMatchObject({
      status: 'failed',
      message: 'index build exploded',
    });

    // A later attempt rebuilds from scratch and succeeds.
    const recovered = await manager.estimate(query());
    expect(recovered.status).toBe('estimated');
    expect(recovered.caseBaseGeneration).toBe(2);
    expect(recovered.references).toHaveLength(2);
  });

  it('reports a failed status when the case-base generation cannot be read', async () => {
    const source = new MutableSource([fixtureCase({ id: 'A' })]);
    source.failGeneration = true;
    const manager = new CaseBaseIndexManager({ source });

    expect(manager.getStatus()).toMatchObject({ status: 'failed' });
    const result = await manager.estimate(query());
    expect(result.withholding?.code).toBe('INDEKS_GAGAL_DIBANGUN');
  });

  it('rebuilds when the configuration changes after a ready index', async () => {
    const source = new MutableSource([fixtureCase({ id: 'A' })]);
    const manager = new CaseBaseIndexManager({ source });
    await manager.warm();

    manager.setConfig(
      resolveRetrievalConfig({
        retrieval: { maxReferences: 1 },
        components: { attributes: [] },
      }),
    );
    expect(manager.getStatus()).toMatchObject({ status: 'stale' });

    const result = await manager.estimate(query());
    expect(result.scoring.maxReferences).toBe(1);
    expect(manager.getStatus()).toMatchObject({ status: 'ready', generation: 1 });
  });

  it('uses a persisted config change for the next rebuild', async () => {
    const source = new MutableSource([
      fixtureCase({ id: 'A' }),
      fixtureCase({ id: 'B' }),
      fixtureCase({ id: 'C' }),
    ]);
    let persisted = resolveRetrievalConfig({
      retrieval: { maxReferences: 1 },
      components: { attributes: [] },
    });
    const manager = new CaseBaseIndexManager({
      source,
      configSource: () => persisted,
    });

    const initial = await manager.estimate(query());
    expect(initial.scoring.maxReferences).toBe(1);
    expect(initial.references).toHaveLength(1);

    // A stored config write advances the generation in SQLite; simulate both.
    persisted = resolveRetrievalConfig({
      retrieval: { maxReferences: 2 },
      components: { attributes: [] },
    });
    source.generation += 1;

    const changed = await manager.estimate(query());
    expect(manager.getConfigFingerprint()).not.toBe(initial.configFingerprint);
    expect(changed.scoring.maxReferences).toBe(2);
    expect(changed.references).toHaveLength(2);
  });

  it('keeps the build result and status deterministic for the same source', async () => {
    const source = new MutableSource([
      fixtureCase({ id: 'A', outcomeDays: 100 }),
      fixtureCase({ id: 'B', outcomeDays: 200 }),
    ]);
    const first = await new CaseBaseIndexManager({ source }).estimate(query());
    const second = await new CaseBaseIndexManager({ source }).estimate(query());
    expect(second).toEqual(first);
  });
});
