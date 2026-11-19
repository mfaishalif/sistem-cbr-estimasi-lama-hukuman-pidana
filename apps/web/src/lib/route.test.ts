import { describe, expect, it } from 'vitest';
import { caseHref, isEmptyHash, isLegacyHash, parseHash } from './route';

describe('hash routes', () => {
  it('opens the landing for an empty, root, or unknown hash', () => {
    expect(parseHash('')).toEqual({ page: 'beranda' });
    expect(parseHash('#')).toEqual({ page: 'beranda' });
    expect(parseHash('#/')).toEqual({ page: 'beranda' });
    expect(parseHash('#beranda')).toEqual({ page: 'beranda' });
    expect(parseHash('#tidak-ada')).toEqual({ page: 'beranda' });
  });

  it('rewrites only an empty hash to #beranda', () => {
    expect(isEmptyHash('')).toBe(true);
    expect(isEmptyHash('#')).toBe(true);
    expect(isEmptyHash('#/')).toBe(true);
    expect(isEmptyHash('#beranda')).toBe(false);
    expect(isEmptyHash('#estimasi')).toBe(false);
  });

  it('keeps Estimasi deep links, including the legacy #ringkasan', () => {
    expect(parseHash('#estimasi')).toEqual({ page: 'estimasi' });
    expect(parseHash('#/estimasi')).toEqual({ page: 'estimasi' });
    expect(parseHash('#ringkasan')).toEqual({ page: 'estimasi' });
    expect(isLegacyHash('#ringkasan')).toBe(true);
  });

  it('opens Basis kasus with an optional perkara', () => {
    expect(parseHash('#kasus')).toEqual({ page: 'kasus', caseId: null });
    expect(parseHash('#kasus/')).toEqual({ page: 'kasus', caseId: null });
    expect(parseHash(caseHref('a b/1'))).toEqual({ page: 'kasus', caseId: 'a b/1' });
  });
});
