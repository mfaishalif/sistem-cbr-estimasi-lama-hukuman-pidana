import { describe, expect, it } from 'vitest';
import { extractIndictmentArticles, isSpecialLawArticle } from './articles';
import { extractOptionalAttributes } from './attributes';
import { normalizeCategory } from './category';
import {
  courtDisplayFromSlug,
  detectMultipleDefendants,
  extractCaseIdentity,
  extractDefendantName,
  extractRelatedCaseKeys,
  normalizeCasePart,
} from './identity';
import { buildNarrative, sanitizeNarrative } from './narrative';
import { parseDurationExpression, resolveOutcome } from './outcome';
import {
  alternativeArticles,
  singleDefendant,
  specialLaw,
  contradictoryCategory,
  metadataOnly,
  multiDefendant,
  ageWithoutReference,
  relatedA,
  xmlDocument,
} from '../test/fixtures';
import { parseIndoLawXml } from './xml';

function parse(xml: string) {
  return parseIndoLawXml(xml);
}

describe('XML parsing', () => {
  it('reads root attributes and section text', () => {
    const document = parse(singleDefendant);

    expect(document.xmlId).toBe('doc-single');
    expect(document.classification).toBe('pidana-umum');
    expect(document.subClassification).toBe('pencurian');
    expect(document.metadataSentenceDays).toBe(180);
    expect(document.sections.riwayat_dakwaan).toContain('sepeda motor');
  });

  it('rejects malformed XML', () => {
    expect(() => parse('<putusan><kepala_putusan>x</putusan>')).toThrow();
  });
});

describe('duration normalization', () => {
  it('uses 360 days per year, 30 days per month, and keeps days', () => {
    expect(parseDurationExpression('pidana penjara selama 1 satu tahun 2 dua bulan 5 lima hari')?.days).toBe(
      425,
    );
  });

  it('stops at the sentence and does not subtract detention', () => {
    const text =
      'pidana penjara selama 1 satu tahun dan 5 lima bulan 3 menetapkan masa penangkapan dan penahanan yang telah dijalani terdakwa dikurangkan seluruhnya dari pidana yang dijatuhkan denda rp 1 000 000 subsidair 1 satu bulan kurungan';
    expect(parseDurationExpression(text)?.days).toBe(510);
  });

  it('does not subtract a detention period written directly after the sentence', () => {
    expect(
      parseDurationExpression(
        'pidana penjara selama 1 satu tahun dikurangi masa penahanan 2 dua bulan',
      )?.days,
    ).toBe(360);
  });

  it('ignores a prosecutor demand and a statutory sentencing threat', () => {
    expect(
      parseDurationExpression(
        'penuntut umum menuntut pidana penjara selama 5 lima tahun kepada terdakwa',
      ),
    ).toBeNull();
    expect(
      parseDurationExpression(
        'perbuatan tersebut diancam pidana penjara paling lama 5 lima tahun kemudian majelis menjatuhkan pidana penjara selama 1 satu tahun',
      )?.days,
    ).toBe(360);
  });

  it('rejects a suspended or probation sentence even when metadata is positive', () => {
    const document = parse(
      singleDefendant.replace(
        'menetapkan masa penangkapan dan penahanan yang telah dijalani terdakwa dikurangkan seluruhnya dari pidana yang dijatuhkan',
        'dengan masa percobaan 2 dua tahun',
      ),
    );
    const outcome = resolveOutcome(document);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe('outcome_not_positive');
    }
  });

  it('rejects an acquittal even when lama_hukuman is positive', () => {
    const document = parse(singleDefendant.replace('amar="pidana"', 'amar="bebas"'));
    const outcome = resolveOutcome(document);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe('outcome_not_positive');
    }
  });

  it('resolves a metadata-only outcome and records its source', () => {
    const outcome = resolveOutcome(parse(metadataOnly));
    expect(outcome).toMatchObject({
      ok: true,
      days: 240,
      kind: 'metadata',
      location: 'root@lama_hukuman',
    });
  });

  it('rejects conflicting metadata versus verdict text', () => {
    const document = parse(
      singleDefendant.replace('lama_hukuman="180"', 'lama_hukuman="360"'),
    );
    const outcome = resolveOutcome(document);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe('outcome_conflict');
    }
  });
});

describe('case identity', () => {
  it('normalizes a space-separated court and case number', () => {
    const identity = extractCaseIdentity(parse(singleDefendant));

    expect(identity.court).toBe('PN Contoh');
    expect(identity.caseNumber).toBe('12/Pid.B/2024/PN Contoh');
    expect(identity.courtNormalized).toBe('pncontoh');
    expect(identity.caseNumberNormalized).toBe('12pidb2024');
    expect(identity.defendantName).toBe('budi bin ahmad');
  });

  it('formats court slugs without losing multi-word names', () => {
    expect(courtDisplayFromSlug('pn-bale-bandung')).toBe('PN Bale Bandung');
    expect(courtDisplayFromSlug('pn-jakarta-pusat')).toBe('PN Jakarta Pusat');
  });

  it('detects multiple defendants and extracts a single name when possible', () => {
    const multi = parse(multiDefendant);
    expect(detectMultipleDefendants(multi)).toBe(true);
    expect(() => extractCaseIdentity(multi)).toThrow(/multiple defendants/i);

    const single = parse(singleDefendant);
    expect(extractDefendantName(single)).toBe('budi bin ahmad');
    expect(normalizeCasePart('Budi Bin Ahmad')).toBe('budibinahmad');
  });

  it('finds only explicitly cited related case numbers', () => {
    const document = parse(relatedA);
    const identity = extractCaseIdentity(document);
    expect(extractRelatedCaseKeys(document, identity)).toEqual(['pncontoh|23pidb2024']);
  });

  it('matches abbreviated court citations within the document court', () => {
    const document = parse(
      xmlDocument({
        id: 'doc-related-abbreviated',
        courtSlug: 'pn-jakarta-pusat',
        sections: {
          kepala_putusan:
            'putusan nomor 22 pid b 2024 pn jakarta pusat demi keadilan berdasarkan ketuhanan yang maha esa pengadilan negeri jakarta pusat yang mengadili perkara pidana dalam tingkat pertama menjatuhkan putusan sebagai berikut dalam perkara terdakwa',
          riwayat_perkara:
            'setelah membaca berkas perkara ini yang terkait dengan perkara lain nomor 23 pid b 2024 pn jkt pst',
        },
      }),
    );
    const identity = extractCaseIdentity(document);
    expect(extractRelatedCaseKeys(document, identity)).toEqual(['pnjakartapusat|23pidb2024']);
  });
});

describe('safe narrative', () => {
  it('cuts post-verdict reasoning and redacts direct identity', () => {
    const document = parse(singleDefendant);
    const identity = extractCaseIdentity(document);
    const narrative = buildNarrative(document, identity);

    expect(narrative.ok).toBe(true);
    if (narrative.ok) {
      expect(narrative.location).toBe('riwayat_dakwaan');
      expect(narrative.text).not.toContain('budi bin ahmad');
      expect(narrative.text).toContain('[terdakwa]');
    }
  });

  it('rejects a narrative that still contains an outcome duration', () => {
    const document = parse(singleDefendant);
    const identity = extractCaseIdentity(document);
    const result = sanitizeNarrative(
      'bahwa terdakwa budi bin ahmad mengambil sepeda motor milik korban dan kemudian dijatuhi hukuman 2 tahun penjara karena perbuatannya tersebut',
      identity,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('narrative_contains_outcome');
    }
  });
});

describe('indictment articles', () => {
  it('keeps alternative charges instead of choosing the proven one', () => {
    const articles = extractIndictmentArticles(parse(alternativeArticles));
    expect(articles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ law: 'KUHP', article: '372', arrangement: 'primary' }),
        expect.objectContaining({ law: 'KUHP', article: '378', arrangement: 'alternative' }),
      ]),
    );
  });

  it('captures an explicit special law', () => {
    const articles = extractIndictmentArticles(parse(specialLaw));
    expect(articles[0]).toMatchObject({ law: 'UU 35/2009', article: '114', paragraph: '1' });
  });

  it('recognizes a special law from its number and year even without a title', () => {
    expect(
      isSpecialLawArticle({
        law: 'UU 35/2014',
        article: '80',
        normalizedReference: 'uu 35/2014|80',
      }),
    ).toBe(true);
    expect(
      isSpecialLawArticle({
        law: 'UU 22/2009',
        article: '310',
        normalizedReference: 'uu 22/2009|310',
      }),
    ).toBe(false);
  });
});

describe('category and coverage', () => {
  it('keeps a category only when the indictment does not contradict it', () => {
    const document = parse(contradictoryCategory);
    const articles = extractIndictmentArticles(document);
    const category = normalizeCategory(document, articles);

    expect(category.coverageError).toBeNull();
    expect(category.contradicted).toBe(true);
    expect(category.category).toBeNull();
  });

  it('rejects a special-law charge inside a general-criminality label', () => {
    const document = parse(specialLaw);
    const articles = extractIndictmentArticles(document);
    const category = normalizeCategory(document, articles);

    expect(category.coverageError?.code).toBe('special_law_charge');
  });
});

describe('optional attributes', () => {
  it('keeps explicit absence distinct from unknown', () => {
    const withReference = parse(singleDefendant);
    const attributes = extractOptionalAttributes(withReference, 'narasi aman');

    expect(attributes.prior_conviction).toMatchObject({ type: 'enum', value: 'no' });
    expect(attributes.age_years).toMatchObject({ type: 'number', value: 30 });
    expect(attributes.age_reference_date).toMatchObject({
      type: 'text',
      value: '2024-05-20',
    });
    expect(attributes.gender).toMatchObject({ type: 'enum', value: 'laki-laki' });
  });

  it('omits age when no comparable reference date is present', () => {
    const attributes = extractOptionalAttributes(parse(ageWithoutReference), 'narasi aman');
    expect(attributes).not.toHaveProperty('age_years');
    expect(attributes).not.toHaveProperty('age_reference_date');
  });

  it('does not guess an unknown attribute', () => {
    const document = parse(
      singleDefendant.replace(
        'terdakwa menyatakan belum pernah dihukum',
        'terdakwa memberikan keterangan',
      ),
    );
    const attributes = extractOptionalAttributes(document, 'narasi aman');
    expect(attributes).not.toHaveProperty('prior_conviction');
  });

  it('extracts role, victim harm, and weapon/mode only from explicit phrases', () => {
    const attributes = extractOptionalAttributes(
      parse(singleDefendant),
      'terdakwa sebagai pelaku memukul korban hingga luka berat dengan menggunakan senjata tajam jenis parang',
    );

    expect(attributes.role).toMatchObject({ type: 'enum', value: 'pelaku' });
    expect(
      JSON.parse((attributes.victim_harm as { type: 'set'; value: string }).value),
    ).toEqual(['luka-berat']);
    expect(
      JSON.parse((attributes.weapon_or_mode as { type: 'set'; value: string }).value),
    ).toEqual(['senjata-tajam']);
  });

  it('does not invent role, harm, or weapon when the narrative is silent', () => {
    const attributes = extractOptionalAttributes(parse(singleDefendant), 'narasi aman tanpa rincian alat atau akibat');
    expect(attributes).not.toHaveProperty('role');
    expect(attributes).not.toHaveProperty('victim_harm');
    expect(attributes).not.toHaveProperty('weapon_or_mode');
  });

  it('does not take a prior-conviction statement from judge sentencing remarks', () => {
    const document = parse(
      singleDefendant.replace(
        'terdakwa menyatakan belum pernah dihukum',
        'hal hal yang meringankan terdakwa belum pernah dihukum',
      ),
    );
    const attributes = extractOptionalAttributes(document, 'narasi aman');
    expect(attributes).not.toHaveProperty('prior_conviction');
  });
});
