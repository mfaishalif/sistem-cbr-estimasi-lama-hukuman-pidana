import { describe, expect, it } from 'vitest';
import type { EstimateResult, ReferenceDetail } from './api';
import {
  articleMatch,
  candidateFlow,
  candidateSummary,
  comparisonSentence,
  resultMeta,
  scoreParts,
  weightingSentence,
} from './estimate';
import { withholdingCopy } from './withholding';
import { articleKeyLabel, categoryLabel, categoryPhrase } from './vocabulary';

function reference(rank: number, days: number, share: number): ReferenceDetail {
  return {
    rank,
    caseUnitId: `u${rank}`,
    caseGroupId: `g${rank}`,
    identity: { court: 'PN Contoh', caseNumber: `${rank}/Pid.B/2024`, defendantName: 'Rahasia' },
    score: 0.435,
    actualSentenceDays: days,
    components: [
      { key: 'narration', kind: 'narrative', weight: 1, normalizedWeight: 0, similarity: 0.5, contribution: 0.5 },
      {
        key: 'articles',
        kind: 'articles',
        weight: 0.5,
        normalizedWeight: 0,
        similarity: 0.5,
        contribution: 0.25,
        detail: {
          queryArticles: ['kuhp|362', 'kuhp|363|1'],
          candidateArticles: ['kuhp|362', 'kuhp|480'],
          intersection: ['kuhp|362'],
          union: ['kuhp|362', 'kuhp|363|1', 'kuhp|480'],
        },
      },
      { key: 'gender', kind: 'attribute', weight: 0.1, normalizedWeight: 0, similarity: 1, contribution: 0.1 },
    ],
    comparison: {
      queryKnownWeight: 0.6,
      comparableWeight: 0.6,
      coverage: 1,
      comparedAttributeKeys: ['gender'],
      missingCandidateAttributeKeys: [],
      notComparableAttributeKeys: [],
      queryMissingAttributeKeys: [],
      missingCandidateArticleKeys: [],
      articlesCompared: true,
    },
    reuse: { weight: 0.435, weightShare: share, weightedOutcomeDays: days * 0.435 },
    facts: { narration: 'x' },
    sources: [],
  };
}

function result(overrides: Partial<EstimateResult> = {}): EstimateResult {
  return {
    status: 'estimated',
    caseBaseGeneration: 3,
    configFingerprint: 'abc',
    category: { requested: 'pencurian', restriction: 'same-category' },
    query: {
      tokenCount: 10,
      recognizedTermCount: 8,
      vectorNorm: 1,
      category: 'pencurian',
      categoryRestriction: 'same-category',
      categoryCandidateCount: 90,
      articleCount: 0,
      knownAttributeKeys: [],
      missingAttributeKeys: [],
    },
    estimate: { days: 336, rawDays: 336.2, numerator: 1, denominator: 1, rounding: 'nearest-day-half-up' },
    withholding: null,
    references: [reference(1, 240, 0.2), reference(2, 360, 0.5), reference(3, 400, 0.3)],
    scoring: {
      configFingerprint: 'abc',
      narrativeWeight: 1,
      articleWeight: 0.5,
      configuredAttributeWeight: 1.6,
      maxReferences: 5,
      minReferences: 2,
      minScore: 0,
      minAttributeCoverage: 0,
      similarityFormula: '',
      reuseFormula: '',
      candidates: {
        eligibleCaseCount: 5782,
        searchScope: 'same-category',
        afterCategoryCount: 90,
        afterExclusionCount: 90,
        scoredCount: 90,
        rejectedBelowScore: 0,
        rejectedCoverage: 0,
        selectedCount: 3,
      },
    },
    ...overrides,
  };
}

describe('score explanation', () => {
  it('splits the score into parts that add up to it', () => {
    const parts = scoreParts(reference(1, 240, 0.2));
    expect(parts.map((part) => part.label)).toEqual(['Kronologi', 'Pasal dakwaan', 'Detail perkara']);
    const total = parts.reduce((sum, part) => sum + part.value, 0);
    expect(total).toBeCloseTo(0.85 / 1.6, 10);
  });

  it('lists matched and differing articles from the engine detail', () => {
    expect(articleMatch(reference(1, 240, 0.2))).toEqual({
      compared: true,
      matched: ['KUHP 362'],
      onlyQuery: ['KUHP 363 ayat 1'],
      onlyRuling: ['KUHP 480'],
    });
  });
});

describe('result sentences', () => {
  it('names the most influential ruling with real numbers', () => {
    expect(weightingSentence(result())).toBe(
      'Estimasi adalah rata-rata hukuman 3 putusan serupa, ditimbang menurut tingkat kemiripannya. Putusan #2 berpengaruh 50%.',
    );
  });

  it('builds the meta line', () => {
    expect(resultMeta(result())).toBe('336 hari · dari 3 putusan serupa · kategori pencurian');
    expect(
      resultMeta(result({ category: { requested: null, restriction: 'all-categories' } })),
    ).toBe('336 hari · dari 3 putusan serupa · semua kategori');
  });

  it('compares the actual ruling with the estimate', () => {
    expect(comparisonSentence(336, 300)).toBe('Selisih 36 hari lebih rendah dari estimasi (± 1 bulan).');
    expect(comparisonSentence(336, 350)).toBe('Selisih 14 hari lebih tinggi dari estimasi.');
    expect(comparisonSentence(336, 336)).toBe('Sama dengan estimasi.');
    expect(comparisonSentence(null, 300)).toBeNull();
  });

  it('summarises the candidate funnel', () => {
    expect(candidateSummary(result())).toBe('90 putusan dibandingkan → 3 dipakai');
    expect(candidateFlow(result()).map((step) => step.count)).toEqual([5782, 90, 90, 3]);
  });
});

describe('withholding copy', () => {
  it('suggests widening the search when the category is too narrow', () => {
    const copy = withholdingCopy(
      result({
        status: 'withheld',
        withholding: { code: 'REFERENSI_TIDAK_CUKUP', message: 'raw', details: { selectedCount: 1 } },
      }),
    );
    expect(copy?.action).toBe('search-all-categories');
    expect(copy?.body).toContain('Putusan serupa dalam kategori ini terlalu sedikit.');
    expect(copy?.body).toContain('Ditemukan 1 dari minimal 2 putusan serupa.');
    expect(copy?.body).not.toContain('REFERENSI');
  });

  it('asks for more narrative when no word is recognised', () => {
    const copy = withholdingCopy(
      result({ status: 'withheld', withholding: { code: 'NARASI_TIDAK_TERBANDING', message: 'raw' } }),
    );
    expect(copy?.body).toBe('Kronologi belum memuat kata yang dikenali. Tambahkan uraian kejadian.');
  });

  it('returns null for an estimated result', () => {
    expect(withholdingCopy(result())).toBeNull();
  });
});

describe('vocabulary', () => {
  it('tidies labels without changing slugs', () => {
    expect(categoryLabel('kejahatan-terhadap-keteriban-umum')).toBe('Kejahatan terhadap ketertiban umum');
    expect(categoryPhrase('lalu-lintas')).toBe('lalu lintas');
    expect(categoryLabel('kategori-baru')).toBe('Kategori baru');
    expect(categoryLabel('')).toBeNull();
    expect(articleKeyLabel('kuhp|363|1')).toBe('KUHP 363 ayat 1');
  });
});
