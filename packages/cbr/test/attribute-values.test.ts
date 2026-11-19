import { describe, expect, it } from 'vitest';
import {
  normalizeAttributeValue,
  normalizeEducation,
  normalizeOccupation,
} from '../src/attribute-values';

describe('attribute value normalization', () => {
  it('maps clear education aliases to canonical levels', () => {
    expect(normalizeEducation('  SMA  ')).toBe('sma');
    expect(normalizeEducation('SLTA')).toBe('sma');
    expect(normalizeEducation('sma tamat')).toBe('sma');
    expect(normalizeEducation('Sekolah Dasar')).toBe('sd');
    expect(normalizeEducation('SLTP')).toBe('smp');
    expect(normalizeEducation('D3')).toBe('diploma');
    expect(normalizeEducation('S-1')).toBe('sarjana');
    expect(normalizeEducation('Magister')).toBe('pascasarjana');
    expect(normalizeEducation('tidak sekolah')).toBe('tidak-sekolah');
  });

  it('drops empty, punctuation-only, defendant labels, and unknown markers', () => {
    for (const value of ['', '   ', '-', '—', 'terdakwa', 'Terdakwa', 'tidak diketahui', 'belum diketahui', 'N/A', 'null']) {
      expect(normalizeEducation(value)).toBeNull();
    }
  });

  it('keeps meaningful education values outside the known aliases', () => {
    expect(normalizeEducation('sd tidak tamat')).toBe('sd tidak tamat');
    expect(normalizeEducation('pondok pesantren')).toBe('pondok pesantren');
  });

  it('maps occupation aliases without dropping meaningful free text', () => {
    expect(normalizeOccupation(' Tani ')).toBe('petani');
    expect(normalizeOccupation('Karyawan   Swasta')).toBe('swasta');
    expect(normalizeOccupation('TIDAK BEKERJA')).toBe('tidak bekerja');
    expect(normalizeOccupation('buruh harian')).toBe('buruh harian');
    expect(normalizeOccupation('terdakwa')).toBeNull();
  });

  it('is idempotent for canonical values', () => {
    for (const value of ['tidak-sekolah', 'sd', 'smp', 'sma', 'diploma', 'sarjana', 'pascasarjana']) {
      expect(normalizeEducation(value)).toBe(value);
    }
    expect(normalizeOccupation('petani')).toBe('petani');
    expect(normalizeOccupation('swasta')).toBe('swasta');
  });

  it('uses the same rule through the generic entry point', () => {
    expect(normalizeAttributeValue('education', 'SLTA')).toBe('sma');
    expect(normalizeAttributeValue('occupation', 'tani')).toBe('petani');
    expect(normalizeAttributeValue('gender', 'Laki-Laki')).toBe('laki-laki');
    expect(normalizeAttributeValue('role', 'terdakwa')).toBeNull();
    expect(normalizeAttributeValue('role', '-')).toBeNull();
  });
});
