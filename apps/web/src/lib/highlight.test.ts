import { describe, expect, it } from 'vitest';
import { excerpt, highlightTerms, normalizeWord, sharedTerms, tokenize } from './highlight';

describe('normalization mirrors the engine', () => {
  it('strips diacritics, lowercases, and splits on non-alphanumerics', () => {
    expect(normalizeWord('Café—Motor, RUMAH!')).toBe('cafe motor rumah');
    expect(tokenize('a Sepeda-motor 1 x 12')).toEqual(['sepeda', 'motor', '12']);
  });

  it('skips display stopwords and bare numbers from highlighting', () => {
    const terms = highlightTerms('Terdakwa mengambil motor yang diparkir di depan rumah 2 unit');
    expect(terms.has('motor')).toBe(true);
    expect(terms.has('yang')).toBe(false);
    expect(terms.has('di')).toBe(false);
    expect(terms.has('2')).toBe(false);
  });
});

describe('excerpt', () => {
  it('marks shared words, including accented and capitalised forms', () => {
    const terms = highlightTerms('motor dicuri');
    const result = excerpt('Sebuah MOTOR telah dicuri.', terms);
    expect(result.segments).toEqual([
      { text: 'Sebuah ', match: false },
      { text: 'MOTOR', match: true },
      { text: ' telah ', match: false },
      { text: 'dicuri', match: true },
      { text: '.', match: false },
    ]);
    expect(result.clippedStart).toBe(false);
  });

  it('centres a long text on the densest cluster of matches', () => {
    const filler = 'lorem ipsum dolor sit amet '.repeat(20);
    const text = `${filler}terdakwa mengambil sepeda motor korban pada malam hari ${filler}`;
    const result = excerpt(text, highlightTerms('sepeda motor malam'), 120);
    const joined = result.segments.map((segment) => segment.text).join('');
    expect(joined).toContain('sepeda motor');
    expect(joined.length).toBeLessThanOrEqual(120);
    expect(result.clippedStart).toBe(true);
    expect(result.clippedEnd).toBe(true);
    expect(result.segments.filter((segment) => segment.match).map((s) => s.text)).toEqual([
      'sepeda',
      'motor',
      'malam',
    ]);
  });

  it('falls back to the opening when nothing matches', () => {
    const text = 'satu dua tiga empat lima enam tujuh delapan sembilan sepuluh '.repeat(10);
    const result = excerpt(text, highlightTerms('motor'), 60);
    expect(result.clippedStart).toBe(false);
    expect(result.segments.every((segment) => !segment.match)).toBe(true);
  });
});

describe('sharedTerms', () => {
  it('orders by frequency in the ruling', () => {
    expect(
      sharedTerms('motor rumah malam', 'motor di rumah, motor lagi pada malam dan motor'),
    ).toEqual(['motor', 'malam', 'rumah']);
  });
});
