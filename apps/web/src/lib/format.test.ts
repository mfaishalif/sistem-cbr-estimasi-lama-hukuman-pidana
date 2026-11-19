import { describe, expect, it } from 'vitest';
import {
  countWords,
  formatDate,
  formatDecimal,
  formatInteger,
  formatPercent,
  formatRupiah,
  formatRupiahInput,
  parseDecimalInput,
  rupiahDigits,
} from './format';

describe('format', () => {
  it('uses id-ID separators', () => {
    expect(formatInteger(5782)).toBe('5.782');
    expect(formatDecimal(0.3449)).toBe('0,34');
    expect(formatPercent(0.435)).toBe('44%');
    expect(formatPercent(0.9862, 2)).toBe('98,62%');
  });

  it('formats rupiah without space or decimals', () => {
    expect(formatRupiah(12_500_000)).toBe('Rp12.500.000');
    expect(rupiahDigits('Rp 12.500.000')).toBe('12500000');
    expect(rupiahDigits('')).toBe('');
    expect(formatRupiahInput('0012500')).toBe('12.500');
  });

  it('formats dates as "19 Nov 2026"', () => {
    expect(formatDate('2026-11-19T12:00:00')).toBe('19 Nov 2026');
    expect(formatDate('bukan tanggal')).toBe('—');
  });

  it('parses decimal input with comma or dot', () => {
    expect(parseDecimalInput('1,5')).toBe(1.5);
    expect(parseDecimalInput('10')).toBe(10);
    expect(parseDecimalInput('')).toBeNull();
    expect(parseDecimalInput('1-2')).toBeNaN();
  });

  it('counts words', () => {
    expect(countWords('  terdakwa   mengambil motor ')).toBe(3);
    expect(countWords('')).toBe(0);
  });
});
