import { describe, expect, it } from 'vitest';
import {
  buildRetrievalIndex,
  estimateWithIndex,
  resolveRetrievalConfig,
  RetrievalConfigError,
} from '../src';
import { fixtureCase } from './fixtures';

const CATEGORICAL_ATTRIBUTES = [
  { attributeKey: 'gender', weight: 1, comparator: 'categorical' as const },
  { attributeKey: 'occupation', weight: 1, comparator: 'categorical' as const },
];

describe('evaluation retrieval configuration', () => {
  it('shares the attribute group weight equally across query-known attributes', () => {
    const config = resolveRetrievalConfig({
      components: {
        narrativeWeight: 1,
        articleWeight: 0,
        attributes: CATEGORICAL_ATTRIBUTES,
        attributeGroupWeight: 0.05,
      },
      retrieval: { minAttributeCoverage: 0 },
    });

    const index = buildRetrievalIndex(
      [
        fixtureCase({
          id: 'A',
          attributes: {
            gender: { type: 'enum', value: 'laki-laki' },
            occupation: { type: 'text', value: 'swasta' },
          },
        }),
        fixtureCase({
          id: 'B',
          attributes: { gender: { type: 'enum', value: 'laki-laki' } },
        }),
      ],
      config,
    );

    const result = estimateWithIndex(index, {
      facts: {
        narration: 'terdakwa mengambil sepeda motor milik korban',
        attributes: {
          gender: { type: 'enum', value: 'laki-laki' },
          occupation: { type: 'text', value: 'swasta' },
        },
      },
    });

    expect(result.status).toBe('estimated');
    expect(result.scoring.configuredAttributeWeight).toBeCloseTo(0.05);

    const complete = result.references.find((reference) => reference.caseUnitId === 'A');
    expect(complete?.comparison.coverage).toBe(1);
    expect(
      complete?.components.find((component) => component.key === 'gender')?.weight,
    ).toBeCloseTo(0.025);
    expect(
      complete?.components.find((component) => component.key === 'occupation')?.weight,
    ).toBeCloseTo(0.025);

    const incomplete = result.references.find((reference) => reference.caseUnitId === 'B');
    expect(incomplete?.comparison.coverage).toBeCloseTo(0.5);
    expect(incomplete?.comparison.missingCandidateAttributeKeys).toEqual(['occupation']);
  });

  it('uses the full group weight when the query knows one attribute', () => {
    const config = resolveRetrievalConfig({
      components: {
        narrativeWeight: 1,
        articleWeight: 0,
        attributes: CATEGORICAL_ATTRIBUTES,
        attributeGroupWeight: 0.05,
      },
    });
    const index = buildRetrievalIndex(
      [
        fixtureCase({
          id: 'A',
          attributes: { gender: { type: 'enum', value: 'laki-laki' } },
        }),
      ],
      config,
    );
    const result = estimateWithIndex(index, {
      facts: {
        narration: 'terdakwa mengambil sepeda motor milik korban',
        attributes: { gender: { type: 'enum', value: 'laki-laki' } },
      },
    });

    const gender = result.references[0]?.components.find(
      (component) => component.key === 'gender',
    );
    expect(gender?.weight).toBeCloseTo(0.05);
  });

  it('drops terms below the minimum document frequency from the vocabulary', () => {
    const strict = resolveRetrievalConfig({
      preprocessing: { minDocumentFrequency: 2 },
    });
    const cases = [
      fixtureCase({ id: 'A', narration: 'terdakwa mengambil sepeda motor' }),
      fixtureCase({ id: 'B', narration: 'terdakwa mengambil mobil' }),
    ];
    const strictIndex = buildRetrievalIndex(cases, strict);

    const withheld = estimateWithIndex(strictIndex, {
      facts: { narration: 'sepeda motor' },
    });
    expect(withheld.status).toBe('withheld');
    expect(withheld.withholding?.code).toBe('NARASI_TIDAK_TERBANDING');

    const lenient = resolveRetrievalConfig({
      preprocessing: { minDocumentFrequency: 1 },
    });
    const lenientIndex = buildRetrievalIndex(cases, lenient);
    const estimated = estimateWithIndex(lenientIndex, {
      facts: { narration: 'sepeda motor' },
    });
    expect(estimated.status).toBe('estimated');
  });

  it('rejects invalid preprocessing and group-weight values', () => {
    expect(() =>
      resolveRetrievalConfig({ preprocessing: { minDocumentFrequency: 0 } }),
    ).toThrow(RetrievalConfigError);
    expect(() =>
      resolveRetrievalConfig({ components: { attributeGroupWeight: -0.1 } }),
    ).toThrow(RetrievalConfigError);
    expect(() =>
      resolveRetrievalConfig({ components: { attributeGroupWeight: Number.NaN } }),
    ).toThrow(RetrievalConfigError);
  });
});
