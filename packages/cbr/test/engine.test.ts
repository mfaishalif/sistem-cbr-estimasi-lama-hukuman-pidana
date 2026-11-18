import { describe, expect, it } from 'vitest';
import {
  buildRetrievalIndex,
  computeWeightedReuse,
  DuplicateCaseUnitIdError,
  estimateWithIndex,
  resolveRetrievalConfig,
} from '../src';
import type { CaseBaseCase, EstimateResult } from '../src';
import { fixtureCase } from './fixtures';

type AttributeOverrides = Parameters<typeof resolveRetrievalConfig>[0];

function configWithAttributes(
  attributes: NonNullable<
    NonNullable<AttributeOverrides['components']>['attributes']
  >,
  extra: AttributeOverrides = {},
): ReturnType<typeof resolveRetrievalConfig> {
  return resolveRetrievalConfig({
    ...extra,
    components: { ...extra.components, attributes },
  });
}

function build(cases: readonly CaseBaseCase[], config = resolveRetrievalConfig()) {
  return buildRetrievalIndex(cases, config, { generation: 7 });
}

function referenceIds(result: EstimateResult): string[] {
  return result.references.map((reference) => reference.caseUnitId);
}

describe('weighted Reuse', () => {
  it('reproduces the agreed hand calculation', () => {
    const reuse = computeWeightedReuse([
      { caseUnitId: 'A', score: 0.8, actualSentenceDays: 360 },
      { caseUnitId: 'B', score: 0.4, actualSentenceDays: 720 },
    ]);

    expect(reuse.status).toBe('available');
    expect(reuse.numerator).toBeCloseTo(576);
    expect(reuse.denominator).toBeCloseTo(1.2);
    expect(reuse.rawDays).toBeCloseTo(480);
    expect(reuse.days).toBe(480);
  });

  it('rounds the displayed day value but keeps the raw value', () => {
    const halfUp = computeWeightedReuse([
      { caseUnitId: 'A', score: 1, actualSentenceDays: 480.5 },
    ]);
    expect(halfUp.rawDays).toBe(480.5);
    expect(halfUp.days).toBe(481);
  });

  it('withholds instead of dividing by zero', () => {
    expect(computeWeightedReuse([])).toMatchObject({
      status: 'withheld',
      reason: 'NO_REFERENCES',
      days: null,
    });
  });
});

describe('Retrieve scoring', () => {
  const genderOnly = configWithAttributes([
    { attributeKey: 'gender', weight: 1, comparator: 'categorical' },
  ]);

  it('renormalises available weights and reports the hand-computed components', () => {
    const index = build(
      [
        fixtureCase({
          id: 'A',
          attributes: { gender: { type: 'enum', value: 'laki-laki' } },
        }),
        fixtureCase({
          id: 'B',
          attributes: { gender: { type: 'enum', value: 'perempuan' } },
        }),
      ],
      genderOnly,
    );

    const result = estimateWithIndex(index, {
      facts: {
        narration: 'terdakwa mengambil sepeda motor milik korban',
        attributes: { gender: { type: 'enum', value: 'laki-laki' } },
      },
    });

    expect(result.status).toBe('estimated');
    expect(referenceIds(result)).toEqual(['A', 'B']);

    const match = result.references[0];
    expect(match?.score).toBe(1);
    expect(match?.components.map((component) => component.key)).toEqual([
      'narration',
      'gender',
    ]);
    expect(match?.components[0]).toMatchObject({
      weight: 1,
      normalizedWeight: 0.5,
      similarity: 1,
      contribution: 1,
    });
    expect(match?.components[1]).toMatchObject({
      weight: 1,
      normalizedWeight: 0.5,
      similarity: 1,
      contribution: 1,
    });

    const mismatch = result.references[1];
    expect(mismatch?.components[1]?.similarity).toBe(0);
    expect(mismatch?.score).toBe(0.5);
  });

  it('does not treat a missing attribute as zero or as a perfect match', () => {
    const index = build(
      [
        fixtureCase({ id: 'A' }),
        fixtureCase({
          id: 'B',
          attributes: { gender: { type: 'enum', value: 'laki-laki' } },
        }),
      ],
      genderOnly,
    );

    const result = estimateWithIndex(index, {
      facts: {
        narration: 'terdakwa mengambil sepeda motor milik korban',
        attributes: { gender: { type: 'enum', value: 'laki-laki' } },
      },
    });

    expect(referenceIds(result)).toEqual(['A', 'B']);
    const missing = result.references[0];
    expect(missing?.caseUnitId).toBe('A');
    expect(missing?.comparison).toMatchObject({
      queryKnownWeight: 1,
      comparableWeight: 0,
      coverage: 0,
      missingCandidateAttributeKeys: ['gender'],
    });
    expect(missing?.components.map((component) => component.key)).toEqual(['narration']);
  });

  it('treats an explicit zero as a known value and an absent value as unknown', () => {
    const zeroConfig = configWithAttributes([
      { attributeKey: 'loss_amount_idr', weight: 1, comparator: 'number-range' },
    ]);
    const index = build(
      [
        fixtureCase({
          id: 'A',
          attributes: { loss_amount_idr: { type: 'number', value: 0 } },
        }),
        fixtureCase({ id: 'B' }),
      ],
      zeroConfig,
    );

    const withZero = estimateWithIndex(index, {
      facts: {
        narration: 'terdakwa mengambil sepeda motor milik korban',
        attributes: { loss_amount_idr: { type: 'number', value: 0 } },
      },
    });

    expect(withZero.query.knownAttributeKeys).toContain('loss_amount_idr');
    const known = withZero.references.find((reference) => reference.caseUnitId === 'A');
    expect(known?.components.map((component) => component.key)).toEqual([
      'narration',
      'loss_amount_idr',
    ]);
    expect(known?.components[1]?.similarity).toBe(1);

    const unknown = withZero.references.find((reference) => reference.caseUnitId === 'B');
    expect(unknown?.comparison.missingCandidateAttributeKeys).toEqual([
      'loss_amount_idr',
    ]);
    expect(unknown?.components.map((component) => component.key)).toEqual(['narration']);

    const withoutZero = estimateWithIndex(index, {
      facts: {
        narration: 'terdakwa mengambil sepeda motor milik korban',
      },
    });
    expect(withoutZero.query.missingAttributeKeys).toContain('loss_amount_idr');
  });

  it('distinguishes explicit prior conviction "no" from unknown', () => {
    const priorConfig = configWithAttributes([
      { attributeKey: 'prior_conviction', weight: 1, comparator: 'categorical' },
    ]);
    const index = build(
      [
        fixtureCase({
          id: 'A',
          attributes: { prior_conviction: { type: 'enum', value: 'no' } },
        }),
        fixtureCase({ id: 'B' }),
      ],
      priorConfig,
    );

    const result = estimateWithIndex(index, {
      facts: {
        narration: 'terdakwa mengambil sepeda motor milik korban',
        attributes: { prior_conviction: { type: 'enum', value: 'no' } },
      },
    });

    const explicitNo = result.references.find((reference) => reference.caseUnitId === 'A');
    const unknown = result.references.find((reference) => reference.caseUnitId === 'B');
    expect(explicitNo?.components[1]?.similarity).toBe(1);
    expect(unknown?.comparison.missingCandidateAttributeKeys).toEqual([
      'prior_conviction',
    ]);
  });

  it('only compares an age when both reference dates are comparable', () => {
    const ageConfig = configWithAttributes([
      {
        attributeKey: 'age_years',
        weight: 1,
        comparator: 'number-range',
        requireReferenceDate: true,
        maxReferenceDateGapDays: 30,
      },
    ]);
    const index = build(
      [
        fixtureCase({
          id: 'A',
          attributes: {
            age_years: { type: 'number', value: 25, unit: 'tahun' },
            age_reference_date: { type: 'text', value: '2024-01-01' },
          },
        }),
        fixtureCase({
          id: 'B',
          attributes: {
            age_years: { type: 'number', value: 25, unit: 'tahun' },
            age_reference_date: { type: 'text', value: '2021-01-01' },
          },
        }),
      ],
      ageConfig,
    );

    const result = estimateWithIndex(index, {
      facts: {
        narration: 'terdakwa mengambil sepeda motor milik korban',
        attributes: {
          age_years: { type: 'number', value: 25, unit: 'tahun' },
          age_reference_date: { type: 'text', value: '2024-01-15' },
        },
      },
    });

    const close = result.references.find((reference) => reference.caseUnitId === 'A');
    const far = result.references.find((reference) => reference.caseUnitId === 'B');
    expect(close?.comparison.comparedAttributeKeys).toEqual(['age_years']);
    expect(close?.components[1]?.detail?.referenceDateGapDays).toBeCloseTo(14);
    expect(far?.comparison.notComparableAttributeKeys).toEqual(['age_years']);
    expect(far?.components.map((component) => component.key)).toEqual(['narration']);
  });

  it('reports missing attribute coverage and applies its minimum', () => {
    const threshold = configWithAttributes(
      [
        { attributeKey: 'gender', weight: 1, comparator: 'categorical' },
        { attributeKey: 'role', weight: 1, comparator: 'categorical' },
      ],
      { retrieval: { minAttributeCoverage: 0.5, minReferences: 1 } },
    );
    const index = build([fixtureCase({ id: 'A' })], threshold);

    const result = estimateWithIndex(index, {
      facts: {
        narration: 'terdakwa mengambil sepeda motor milik korban',
        attributes: {
          gender: { type: 'enum', value: 'laki-laki' },
          role: { type: 'enum', value: 'pelaku' },
        },
      },
    });

    expect(result.status).toBe('withheld');
    expect(result.withholding?.code).toBe('REFERENSI_TIDAK_CUKUP');
    expect(result.scoring.candidates.rejectedCoverage).toBe(1);
  });

  it('uses Jaccard similarity for article sets and preserves alternatives', () => {
    const articleConfig = configWithAttributes([], {
      components: { articleWeight: 1 },
    });
    const index = build(
      [
        fixtureCase({
          id: 'A',
          articles: [
            { law: 'KUHP', article: '362', arrangement: 'primary' },
            { law: 'KUHP', article: '363', arrangement: 'alternative' },
          ],
        }),
      ],
      articleConfig,
    );

    const result = estimateWithIndex(index, {
      facts: {
        narration: 'terdakwa mengambil sepeda motor milik korban',
        articles: [
          { law: 'KUHP', article: '362', arrangement: 'primary' },
          { law: 'KUHP', article: '364', arrangement: 'subsidiary' },
        ],
      },
    });

    const articleComponent = result.references[0]?.components.find(
      (component) => component.kind === 'articles',
    );
    expect(articleComponent?.similarity).toBeCloseTo(1 / 3);
    expect(result.references[0]?.comparison.articlesCompared).toBe(true);
  });

  it('reduces coverage when the candidate has no articles to compare', () => {
    const articleConfig = configWithAttributes([], {
      components: { articleWeight: 1 },
    });
    const index = build([fixtureCase({ id: 'A' })], articleConfig);

    const result = estimateWithIndex(index, {
      facts: {
        narration: 'terdakwa mengambil sepeda motor milik korban',
        articles: [{ law: 'KUHP', article: '362' }],
      },
    });

    const reference = result.references[0];
    expect(reference?.comparison.articlesCompared).toBe(false);
    expect(reference?.comparison.coverage).toBe(0);
    expect(reference?.comparison.missingCandidateArticleKeys).toEqual([
      'kuhp|362',
    ]);
    expect(reference?.components.map((component) => component.key)).toEqual([
      'narration',
    ]);
  });
});

describe('Retrieve eligibility and deterministic ordering', () => {
  it('withholds when the query narrative has no recognised training term', () => {
    const index = build([fixtureCase({ id: 'A' })]);
    const result = estimateWithIndex(index, {
      facts: {
        narration: 'zebra kuantum',
        attributes: { gender: { type: 'enum', value: 'laki-laki' } },
      },
    });

    expect(result.status).toBe('withheld');
    expect(result.withholding?.code).toBe('NARASI_TIDAK_TERBANDING');
    expect(result.references).toEqual([]);
    expect(result.estimate.days).toBeNull();
  });

  it('withholds on an empty narrative', () => {
    const index = build([fixtureCase({ id: 'A' })]);
    const result = estimateWithIndex(index, { facts: { narration: '   ' } });
    expect(result.withholding?.code).toBe('NARASI_KOSONG');
  });

  it('ignores non-positive and unknown outcomes when building references', () => {
    const index = build([
      fixtureCase({ id: 'zero', outcomeDays: 0 }),
      fixtureCase({ id: 'unknown', outcomeDays: null }),
      fixtureCase({ id: 'positive', outcomeDays: 120 }),
    ]);

    expect(index.eligibleCaseCount).toBe(1);
    expect(index.excludedCaseCount).toBe(2);

    const result = estimateWithIndex(index, {
      facts: { narration: 'terdakwa mengambil sepeda motor milik korban' },
    });
    expect(result.references.map((reference) => reference.caseUnitId)).toEqual([
      'positive',
    ]);
  });

  it('withholds with an explicit empty case base', () => {
    const index = build([]);
    const result = estimateWithIndex(index, {
      facts: { narration: 'terdakwa mengambil sepeda motor milik korban' },
    });
    expect(result.withholding?.code).toBe('BASIS_KASUS_KOSONG');
  });

  it('restricts to the known category and does not expand on insufficient candidates', () => {
    const cases = [
      fixtureCase({ id: 'A', category: 'pencurian' }),
      fixtureCase({ id: 'B', category: 'penggelapan' }),
    ];
    const index = build(cases);

    const restricted = estimateWithIndex(index, {
      facts: {
        narration: 'terdakwa mengambil sepeda motor milik korban',
        category: ' Pencurian ',
      },
    });
    expect(restricted.category).toEqual({
      requested: 'pencurian',
      restriction: 'same-category',
    });
    expect(referenceIds(restricted)).toEqual(['A']);

    const noCategory = estimateWithIndex(index, {
      facts: {
        narration: 'terdakwa mengambil sepeda motor milik korban',
        category: 'pembunuhan',
      },
    });
    expect(noCategory.status).toBe('withheld');
    expect(noCategory.withholding?.code).toBe('TIDAK_ADA_REFERENSI_KATEGORI');
    expect(noCategory.references).toEqual([]);

    const crossCategory = estimateWithIndex(index, {
      facts: { narration: 'terdakwa mengambil sepeda motor milik korban' },
    });
    expect(crossCategory.category.restriction).toBe('all-categories');
    expect(referenceIds(crossCategory)).toEqual(['A', 'B']);
  });

  it('withholds when fewer than the configured minimum references are available', () => {
    const config = resolveRetrievalConfig({
      retrieval: { minReferences: 2, maxReferences: 5 },
    });
    const index = build([fixtureCase({ id: 'A' })], config);
    const result = estimateWithIndex(index, {
      facts: { narration: 'terdakwa mengambil sepeda motor milik korban' },
    });

    expect(result.status).toBe('withheld');
    expect(result.withholding?.code).toBe('REFERENSI_TIDAK_CUKUP');
    expect(result.references).toHaveLength(1);
    expect(result.estimate.days).toBeNull();
  });

  it('breaks equal scores by stable ID, never by actual outcome', () => {
    const cases = [
      fixtureCase({ id: 'Z', outcomeDays: 100 }),
      fixtureCase({ id: 'A', outcomeDays: 5000 }),
    ];
    const config = resolveRetrievalConfig({ retrieval: { maxReferences: 5 } });

    const forward = estimateWithIndex(build(cases, config), {
      facts: { narration: 'terdakwa mengambil sepeda motor milik korban' },
    });
    const reversed = estimateWithIndex(build([...cases].reverse(), config), {
      facts: { narration: 'terdakwa mengambil sepeda motor milik korban' },
    });

    expect(referenceIds(forward)).toEqual(['A', 'Z']);
    expect(referenceIds(reversed)).toEqual(['A', 'Z']);
    expect(forward).toEqual(reversed);
  });

  it('rejects duplicate case IDs rather than silently retrieving twice', () => {
    expect(() =>
      build([fixtureCase({ id: 'same' }), fixtureCase({ id: 'same' })]),
    ).toThrow(DuplicateCaseUnitIdError);
  });

  it('excludes the query case itself when asked', () => {
    const index = build([
      fixtureCase({ id: 'A' }),
      fixtureCase({ id: 'B' }),
    ]);
    const result = estimateWithIndex(index, {
      facts: { narration: 'terdakwa mengambil sepeda motor milik korban' },
      excludeCaseUnitIds: ['A'],
    });
    expect(referenceIds(result)).toEqual(['B']);
  });
});

describe('fit/transform separation', () => {
  it('learns vocabulary and numeric scales only from the supplied training cases', () => {
    const config = configWithAttributes([
      { attributeKey: 'age_years', weight: 1, comparator: 'number-range' },
    ]);
    const training = [
      fixtureCase({
        id: 'T1',
        narration: 'terdakwa mencuri sepeda motor',
        attributes: { age_years: { type: 'number', value: 20 } },
      }),
      fixtureCase({
        id: 'T2',
        narration: 'terdakwa mencuri sepeda motor',
        attributes: { age_years: { type: 'number', value: 30 } },
      }),
    ];
    const validation = fixtureCase({
      id: 'V1',
      narration: 'zebra kuantum',
      attributes: { age_years: { type: 'number', value: 60 } },
    });

    const index = build(training, config);
    expect(index.eligibleCaseCount).toBe(2);
    expect(index.termModel.idf.has('zebra')).toBe(false);
    expect(index.numericScales.get('age_years')).toMatchObject({ min: 20, max: 30 });

    const result = estimateWithIndex(index, {
      facts: validation.facts,
    });
    expect(result.withholding?.code).toBe('NARASI_TIDAK_TERBANDING');
  });
});

describe('reported provenance', () => {
  it('returns reference facts, source aliases, components, and the calculation', () => {
    const index = build([fixtureCase({ id: 'A', outcomeDays: 480 })]);
    const result = estimateWithIndex(index, {
      facts: { narration: 'terdakwa mengambil sepeda motor milik korban' },
    });

    expect(result.caseBaseGeneration).toBe(7);
    expect(result.references[0]).toMatchObject({
      caseUnitId: 'A',
      actualSentenceDays: 480,
      score: 1,
    });
    expect(result.references[0]?.sources[0]).toMatchObject({
      sourceDocumentId: 'source-A',
      snapshotPath: 'synthetic/A.xml',
    });
    expect(result.references[0]?.facts.narration).toContain('sepeda motor');
    expect(result.estimate).toMatchObject({
      days: 480,
      numerator: 480,
      denominator: 1,
      rounding: 'nearest-day-half-up',
    });
    expect(result.scoring.reuseFormula).toContain('actualSentenceDays');
    expect(result.withholding).toBeNull();
  });
});
