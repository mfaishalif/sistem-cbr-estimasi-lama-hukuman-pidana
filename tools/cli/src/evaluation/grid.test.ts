import { describe, expect, it } from 'vitest';
import {
  buildEvaluationCandidates,
  buildNarrationOnlyConfig,
  EVALUATION_MIN_ATTRIBUTE_COVERAGES,
  EVALUATION_PROPORTIONS,
  EVALUATION_SEED,
  indexStructureKey,
} from './grid';

describe('evaluation grid', () => {
  const candidates = buildEvaluationCandidates();

  it('enumerates the approved 32 combinations in protocol order', () => {
    expect(candidates).toHaveLength(32);
    expect(EVALUATION_SEED).toBe('indo-law-cbr-v1');
    expect(EVALUATION_PROPORTIONS).toEqual({
      training: 0.7,
      validation: 0.15,
      test: 0.15,
    });

    expect(candidates[0]).toMatchObject({
      gridIndex: 0,
      narrativeWeight: 0.75,
      articleWeight: 0.2,
      attributeGroupWeight: 0.05,
      maxReferences: 3,
      minReferences: 1,
      minScore: 0.05,
      minAttributeCoverage: EVALUATION_MIN_ATTRIBUTE_COVERAGES[0],
    });
    expect(candidates[1]?.minAttributeCoverage).toBe(0.85);
    expect(candidates[2]?.minScore).toBe(0.1);
    expect(candidates[4]?.minReferences).toBe(2);
    expect(candidates[8]?.maxReferences).toBe(5);
    expect(candidates[16]?.narrativeWeight).toBe(0.85);
    expect(candidates[16]?.articleWeight).toBe(0.1);
    expect(candidates[31]).toMatchObject({
      gridIndex: 31,
      narrativeWeight: 0.85,
      articleWeight: 0.1,
      attributeGroupWeight: 0.05,
      maxReferences: 5,
      minReferences: 2,
      minScore: 0.1,
      minAttributeCoverage: 0.85,
    });
  });

  it('keeps the decided preprocessing and category restriction', () => {
    for (const candidate of candidates) {
      expect(candidate.config.preprocessing).toMatchObject({
        minTokenLength: 1,
        stopwords: [],
        minDocumentFrequency: 2,
        sublinearTermFrequency: false,
        smoothInverseDocumentFrequency: true,
      });
      expect(candidate.config.categoryRestriction).toBe('when-known');
      expect(candidate.config.components.attributeGroupWeight).toBe(0.05);
      expect(candidate.configFingerprint).toHaveLength(16);
    }
  });

  it('builds the narration-only variant with weights 1/0/0 and the locked limits', () => {
    const locked = candidates[8]?.config;
    expect(locked).toBeDefined();
    const narration = buildNarrationOnlyConfig(locked as NonNullable<typeof locked>);

    expect(narration.components.narrativeWeight).toBe(1);
    expect(narration.components.articleWeight).toBe(0);
    expect(narration.components.attributes).toEqual([]);
    expect(narration.components.attributeGroupWeight).toBeUndefined();
    expect(narration.retrieval).toEqual(locked?.retrieval);
    expect(narration.preprocessing).toEqual(locked?.preprocessing);
  });

  it('reuses an index across candidates that differ only in retrieval limits', () => {
    const base = candidates[0]?.config;
    const otherLimits = candidates[1]?.config;
    const otherWeights = candidates[16]?.config;
    expect(base).toBeDefined();

    expect(indexStructureKey(otherLimits as NonNullable<typeof otherLimits>)).toBe(
      indexStructureKey(base as NonNullable<typeof base>),
    );
    expect(indexStructureKey(otherWeights as NonNullable<typeof otherWeights>)).not.toBe(
      indexStructureKey(base as NonNullable<typeof base>),
    );
  });
});
