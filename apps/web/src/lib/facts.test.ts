import { describe, expect, it } from 'vitest';
import { formatArticle, recordedFacts } from './facts';

describe('recordedFacts', () => {
  it('formats recorded attributes in display order and folds the age date', () => {
    expect(
      recordedFacts({
        loss_amount_idr: { type: 'number', value: 12_500_000, unit: 'IDR' },
        gender: { type: 'enum', value: 'laki-laki' },
        age_years: { type: 'number', value: 30, unit: 'tahun' },
        age_reference_date: { type: 'text', value: '2024-05-20T12:00:00' },
        victim_harm: { type: 'set', value: '["luka-berat"]' },
        prior_conviction: { type: 'enum', value: 'no' },
      }),
    ).toEqual([
      { key: 'gender', label: 'Jenis kelamin', value: 'Laki-laki' },
      { key: 'age_years', label: 'Umur', value: '30 tahun (saat ditangkap 20 Mei 2024)' },
      { key: 'prior_conviction', label: 'Riwayat dihukum', value: 'Belum pernah dihukum' },
      { key: 'victim_harm', label: 'Akibat pada korban', value: 'Luka berat' },
      { key: 'loss_amount_idr', label: 'Kerugian', value: 'Rp12.500.000' },
    ]);
  });

  it('returns nothing when no attribute is recorded', () => {
    expect(recordedFacts(undefined)).toEqual([]);
  });
});

describe('formatArticle', () => {
  it('names non-primary arrangements', () => {
    expect(formatArticle({ law: 'KUHP', article: '363', paragraph: '1', arrangement: 'subsidiary' })).toBe('KUHP 363 ayat 1 (subsidair)');
    expect(formatArticle({ law: 'KUHP', article: '362', arrangement: 'primary' })).toBe('KUHP 362');
  });
});
