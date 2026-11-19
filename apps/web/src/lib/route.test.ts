import { describe, expect, it } from 'vitest';
import { caseHref, isLegacyHash, parseHash } from './route';

describe('hash routes', () => {
  it('defaults to Estimasi', () => {
    expect(parseHash('')).toEqual({ page: 'estimasi' });
    expect(parseHash('#/')).toEqual({ page: 'estimasi' });
    expect(parseHash('#estimasi')).toEqual({ page: 'estimasi' });
    expect(parseHash('#ringkasan')).toEqual({ page: 'estimasi' });
    expect(isLegacyHash('#ringkasan')).toBe(true);
  });

  it('opens Basis kasus with an optional perkara', () => {
    expect(parseHash('#kasus')).toEqual({ page: 'kasus', caseId: null });
    expect(parseHash('#kasus/')).toEqual({ page: 'kasus', caseId: null });
    expect(parseHash(caseHref('a b/1'))).toEqual({ page: 'kasus', caseId: 'a b/1' });
  });
});
