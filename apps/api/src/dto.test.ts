import { describe, expect, it } from 'vitest';
import { ValidationError } from '@cbr/data';
import {
  parseCaseDraft,
  parseEstimateRequest,
  parseOutcomeUpdate,
} from './dto';

const facts = {
  narration: 'Terdakwa mengambil sepeda motor milik korban pada malam hari.',
  category: 'pencurian',
  articles: [{ law: 'KUHP', article: '362', arrangement: 'primary' }],
  attributes: {
    age_years: { type: 'number', value: 27, unit: 'tahun' },
    age_reference_date: { type: 'text', value: '2024-03-01' },
    victim_harm: { type: 'set', value: '["luka ringan"]' },
    prior_conviction: { type: 'enum', value: 'no' },
  },
};

describe('API input parsing', () => {
  it('builds a normalized case draft and keeps optional facts explicit', () => {
    const draft = parseCaseDraft({
      court: 'PN Contoh',
      caseNumber: '1/Pid.B/2024/PN Contoh',
      defendantName: 'Sintetis',
      ...facts,
      actualSentenceDays: 180,
    });

    expect(draft.court).toBe('PN Contoh');
    expect(draft.actualSentenceDays).toBe(180);
    expect(draft.articles?.[0]?.normalizedReference).toBe('kuhp|362');
    expect(draft.attributes?.victim_harm).toEqual({
      type: 'set',
      value: '["luka ringan"]',
    });
    expect(draft.attributes?.prior_conviction).toEqual({ type: 'enum', value: 'no' });
  });

  it('round-trips an estimate request with excluded case IDs', () => {
    const request = parseEstimateRequest({
      facts,
      excludeCaseUnitIds: ['case-1'],
    });

    expect(request.excludeCaseUnitIds).toEqual(['case-1']);
    expect(request.facts.narration).toContain('sepeda motor');
    expect(request.facts.attributes?.age_years).toEqual({
      type: 'number',
      value: 27,
      unit: 'tahun',
    });
  });

  it('rejects blank narration and invalid outcomes before the engine runs', () => {
    expect(() =>
      parseEstimateRequest({ narration: '   ' }),
    ).toThrow(ValidationError);

    expect(() =>
      parseCaseDraft({
        court: 'PN Contoh',
        caseNumber: '1/Pid.B/2024/PN Contoh',
        narration: 'Narasi.',
        actualSentenceDays: 1.5,
      }),
    ).toThrow(ValidationError);

    expect(() =>
      parseCaseDraft({
        court: 'PN Contoh',
        caseNumber: '1/Pid.B/2024/PN Contoh',
        narration: 'Narasi.',
        actualSentenceDays: -1,
      }),
    ).toThrow(ValidationError);
  });

  it('rejects malformed facts with a domain validation message', () => {
    expect(() =>
      parseCaseDraft({
        court: 'PN Contoh',
        caseNumber: '1/Pid.B/2024/PN Contoh',
        narration: 'Narasi.',
        articles: [{ law: 'KUHP', article: '' }],
      }),
    ).toThrow(ValidationError);

    expect(() =>
      parseCaseDraft({
        court: 'PN Contoh',
        caseNumber: '1/Pid.B/2024/PN Contoh',
        narration: 'Narasi.',
        attributes: { prior_conviction: { type: 'enum', value: 'maybe' } },
      }),
    ).toThrow(ValidationError);
  });

  it('distinguishes an unknown outcome from a missing update', () => {
    expect(parseOutcomeUpdate({ actualSentenceDays: null })).toBeNull();
    expect(parseOutcomeUpdate({ actualSentenceDays: 0 })).toBe(0);
    expect(() => parseOutcomeUpdate({})).toThrow(ValidationError);
  });
});
