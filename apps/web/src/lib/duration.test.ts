import { describe, expect, it } from 'vitest';
import { bestUnit, formatMonthsTick, formatSentence, formatSentenceApprox, toDays } from './duration';

describe('formatSentence (360/30)', () => {
  it.each([
    [0, '0 hari'],
    [29, '29 hari'],
    [30, '1 bulan'],
    [45, '1 bulan 15 hari'],
    [336, '11 bulan 6 hari'],
    [360, '1 tahun'],
    [365, '1 tahun 5 hari'],
    [420, '1 tahun 2 bulan'],
    [720, '2 tahun'],
    [7200, '20 tahun'],
  ])('%i hari → %s', (days, expected) => {
    expect(formatSentence(days)).toBe(expected);
  });
});

describe('formatSentenceApprox', () => {
  it.each([
    [0, '0 hari'],
    [29, '± 29 hari'],
    [30, '± 1 bulan'],
    [336, '± 11 bulan'],
    [360, '± 1 tahun'],
    [365, '± 1 tahun'],
    [720, '± 2 tahun'],
    [7200, '± 20 tahun'],
    [500, '± 1 tahun 5 bulan'],
  ])('%i hari → %s', (days, expected) => {
    expect(formatSentenceApprox(days)).toBe(expected);
  });
});

describe('toDays and ticks', () => {
  it('converts units with the 360/30 convention', () => {
    expect(toDays(1, 'tahun')).toBe(360);
    expect(toDays(1.5, 'tahun')).toBe(540);
    expect(toDays(10, 'bulan')).toBe(300);
    expect(toDays(45, 'hari')).toBe(45);
  });

  it('formats compact month ticks', () => {
    expect(formatMonthsTick(0)).toBe('0');
    expect(formatMonthsTick(6)).toBe('6 bln');
    expect(formatMonthsTick(12)).toBe('1 thn');
    expect(formatMonthsTick(18)).toBe('1 thn 6 bln');
  });
});

describe('bestUnit', () => {
  it('picks the largest whole unit', () => {
    expect(bestUnit(720)).toEqual({ amount: '2', unit: 'tahun' });
    expect(bestUnit(300)).toEqual({ amount: '10', unit: 'bulan' });
    expect(bestUnit(45)).toEqual({ amount: '45', unit: 'hari' });
  });
});
