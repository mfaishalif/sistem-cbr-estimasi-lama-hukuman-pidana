import { describe, expect, it } from 'vitest';
import type { IndexStatus } from './api';
import { formatInteger } from './format';
import { caseBaseFact } from './landing';

const ready = (caseCount: number): IndexStatus => ({
  status: 'ready',
  generation: 31407,
  configFingerprint: 'abc',
  caseCount,
  eligibleCaseCount: caseCount,
  termCount: 59699,
  buildDurationMs: 3000,
  builtAt: '2026-11-19T00:00:00Z',
});

describe('caseBaseFact', () => {
  it('is loading before the first status arrives', () => {
    expect(caseBaseFact(null, null)).toEqual({ state: 'loading' });
  });

  it('shows the count with a thousands dot when the index is ready', () => {
    expect(caseBaseFact(ready(5782), null)).toEqual({ state: 'ready', count: '5.782' });
    expect(formatInteger(5782)).toBe('5.782');
  });

  it('hides the number on error or when the index is not ready', () => {
    expect(caseBaseFact(null, 'API membalas 500')).toEqual({ state: 'unavailable' });
    expect(caseBaseFact({ status: 'building', targetGeneration: 1, startedAt: '' }, null)).toEqual({ state: 'unavailable' });
    expect(
      caseBaseFact({ status: 'stale', reason: 'NOT_BUILT', currentGeneration: 1, indexGeneration: null }, null),
    ).toEqual({ state: 'unavailable' });
    expect(caseBaseFact({ status: 'failed', message: 'x', generation: 1, failedAt: '' }, null)).toEqual({ state: 'unavailable' });
    expect(caseBaseFact(ready(0), null)).toEqual({ state: 'unavailable' });
  });
});
