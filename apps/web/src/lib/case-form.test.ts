import { describe, expect, it } from 'vitest';
import type { CaseUnit } from './api';
import {
  buildFacts,
  caseFormFromUnit,
  detailSummary,
  draftFromFacts,
  emptyCaseForm,
  newArticleRow,
  parseSentenceInput,
  validateIdentity,
  validateNarration,
  type FieldError,
} from './case-form';

describe('buildFacts', () => {
  it('sends nothing for unknown fields', () => {
    const errors: FieldError[] = [];
    const facts = buildFacts({ ...emptyCaseForm(), narration: '  kronologi  ' }, errors);
    expect(errors).toEqual([]);
    expect(facts).toEqual({ narration: 'kronologi', category: null, articles: [], attributes: {} });
  });

  it('maps every control to the existing wire types', () => {
    const errors: FieldError[] = [];
    const facts = buildFacts(
      {
        ...emptyCaseForm(),
        narration: 'kronologi',
        category: 'kealfaan-mengakibatkan-kematianluka',
        articles: [newArticleRow({ article: '359', paragraph: '', arrangement: 'alternative' })],
        ageYears: '27',
        ageReferenceDate: '2024-05-20',
        gender: 'laki-laki',
        occupation: ' Buruh Harian ',
        education: 'SMA',
        role: 'turut-serta',
        victimCount: '2',
        victimHarm: ['luka-berat', 'meninggal-dunia'],
        lossAmountIdr: '12500000',
        weaponOrMode: ['senjata-tajam'],
        priorConviction: 'no',
      },
      errors,
    );
    expect(errors).toEqual([]);
    expect(facts.category).toBe('kealfaan-mengakibatkan-kematianluka');
    expect(facts.articles).toEqual([
      { law: 'KUHP', article: '359', paragraph: null, arrangement: 'alternative' },
    ]);
    expect(facts.attributes).toEqual({
      age_years: { type: 'number', value: 27, unit: 'tahun' },
      age_reference_date: { type: 'text', value: '2024-05-20' },
      gender: { type: 'text', value: 'laki-laki' },
      occupation: { type: 'text', value: 'buruh harian' },
      education: { type: 'text', value: 'sma' },
      role: { type: 'text', value: 'turut-serta' },
      victim_count: { type: 'number', value: 2 },
      loss_amount_idr: { type: 'number', value: 12_500_000, unit: 'IDR' },
      victim_harm: { type: 'set', value: '["luka-berat","meninggal-dunia"]' },
      weapon_or_mode: { type: 'set', value: '["senjata-tajam"]' },
      prior_conviction: { type: 'enum', value: 'no' },
    });
  });

  it('requires a reference date when age is filled', () => {
    const errors: FieldError[] = [];
    const facts = buildFacts({ ...emptyCaseForm(), narration: 'x', ageYears: '30' }, errors);
    expect(errors.map((error) => error.field)).toEqual(['age-date']);
    expect(facts.attributes).toEqual({});
  });

  it('ignores an untouched article row and flags a half-filled one', () => {
    const errors: FieldError[] = [];
    const facts = buildFacts(
      {
        ...emptyCaseForm(),
        narration: 'x',
        articles: [newArticleRow(), newArticleRow({ law: '', article: '362' })],
      },
      errors,
    );
    expect(facts.articles).toEqual([]);
    expect(errors).toEqual([
      { field: 'article-1-law', message: expect.stringContaining('baris 2') },
    ]);
  });

  it('rejects non-integer counts', () => {
    const errors: FieldError[] = [];
    buildFacts({ ...emptyCaseForm(), narration: 'x', victimCount: '1,5' }, errors);
    expect(errors.map((error) => error.field)).toEqual(['victim-count']);
  });
});

describe('validation', () => {
  it('links narration and identity errors to their fields', () => {
    const errors: FieldError[] = [];
    validateNarration(emptyCaseForm(), errors);
    validateIdentity({ court: '', caseNumber: ' ', defendantName: '' }, errors);
    expect(errors.map((error) => error.field)).toEqual(['narration', 'court', 'case-number']);
  });
});

describe('parseSentenceInput', () => {
  it('converts amount and unit to days', () => {
    const errors: FieldError[] = [];
    expect(parseSentenceInput('10', 'bulan', 'actual', true, errors)).toBe(300);
    expect(parseSentenceInput('1,5', 'tahun', 'actual', true, errors)).toBe(540);
    expect(errors).toEqual([]);
  });

  it('distinguishes required, optional, and invalid input', () => {
    const errors: FieldError[] = [];
    expect(parseSentenceInput('', 'hari', 'a', false, errors)).toBeNull();
    expect(errors).toEqual([]);
    expect(parseSentenceInput('', 'hari', 'a', true, errors)).toBeNull();
    expect(parseSentenceInput('0', 'hari', 'b', true, errors)).toBeNull();
    expect(parseSentenceInput('abc', 'hari', 'c', true, errors)).toBeNull();
    expect(errors.map((error) => error.field)).toEqual(['a', 'b', 'c']);
  });
});

describe('round trip and retain', () => {
  const unit: CaseUnit = {
    id: 'u1',
    caseGroupId: 'g1',
    identity: { court: 'PN Contoh', caseNumber: '1/Pid.B/2024', defendantName: null },
    facts: {
      narration: 'kronologi',
      category: 'pencurian',
      articles: [{ law: 'KUHP', article: '363', paragraph: '1', arrangement: 'primary' }],
      attributes: {
        victim_harm: { type: 'set', value: '["luka-ringan","lainnya"]' },
        loss_amount_idr: { type: 'number', value: 1500000, unit: 'IDR' },
        prior_conviction: { type: 'enum', value: 'yes' },
        gender: { type: 'enum', value: 'perempuan' },
      },
    },
    outcome: { actualSentenceDays: 240 },
    createdAt: '2026-11-19T00:00:00Z',
    updatedAt: '2026-11-19T00:00:00Z',
    sources: [],
  };

  it('keeps unknown set values when editing a stored unit', () => {
    const form = caseFormFromUnit(unit);
    expect(form.victimHarm).toEqual(['luka-ringan', 'lainnya']);
    expect(form.lossAmountIdr).toBe('1500000');
    const facts = buildFacts(form, []);
    expect(facts.attributes?.victim_harm).toEqual({ type: 'set', value: '["luka-ringan","lainnya"]' });
  });

  it('summarises filled details as chips', () => {
    expect(detailSummary(caseFormFromUnit(unit))).toEqual([
      'KUHP 363 ayat 1',
      'Perempuan',
      'Pernah dihukum',
      'Luka ringan',
      'Lainnya',
      'Kerugian Rp1.500.000',
    ]);
  });

  it('builds a retain draft from the exact estimated facts', () => {
    const facts = buildFacts(caseFormFromUnit(unit), []);
    const draft = draftFromFacts(facts, { court: ' PN A ', caseNumber: '2/X', defendantName: '' }, 300);
    expect(draft).toEqual({
      court: 'PN A',
      caseNumber: '2/X',
      defendantName: null,
      narration: facts.narration,
      category: facts.category,
      articles: facts.articles,
      attributes: facts.attributes,
      actualSentenceDays: 300,
    });
  });
});
