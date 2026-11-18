import type { CaseArticleDraft } from '@cbr/core';
import { articleFamily, isSpecialLawArticle } from './articles';
import type { SkipCode } from './types';
import type { IndoLawDocument } from './xml';

export interface CategoryResolution {
  category: string | null;
  sourceLocation: string | null;
  coverageError: { code: SkipCode; detail: string } | null;
  contradicted: boolean;
}

const SPECIAL_CATEGORIES = new Set([
  'narkotika-dan-psikotropika',
  'narkotika',
  'psikotropika',
  'korupsi',
  'terorisme',
  'pencucian-uang',
  'perlindungan-anak',
  'kekerasan-dalam-rumah-tangga',
  'tindak-pidana-khusus',
]);

const UNKNOWN_CATEGORIES = new Set(['', 'tidak-diketahui', 'tidak-diketahui-kategori', 'unknown']);

const CATEGORY_ALIASES = new Map<string, string>([
  ['pemerasaan-dan-pengancaman', 'pemerasan-dan-pengancaman'],
]);

const KNOWN_GENERAL_CATEGORIES = new Set([
  'pencurian',
  'penggelapan',
  'penipuan',
  'pembunuhan',
  'pemerasan-dan-pengancaman',
  'penadahan',
  'penghinaan',
  'kehutanan',
  'kealfaan-mengakibatkan-kematianluka',
  'kejahatan-terhadap-keamanan-negara',
  'perjudian',
  'pelanggaran-susila',
  'pengrusakan',
  'penganiayaan',
  'pemalsuan',
  'kejahatan-terhadap-kesusilaan',
  'kejahatan-terhadap-keteriban-umum',
  'perusakan',
  'senjata-api',
  'mata-uang',
  'kejahatan-terhadap-kemerdekaan-orang-lain',
  'pemerasaan-dan-pengancaman',
  'kejahatan-terhadap-asal-usul-perkawinan',
  'sumpah-palsu-dan-keterangan-palsu',
  'penyelundupan',
  'imigrasi',
  'perpajakan',
  'merek',
  'konsumen',
  'lingkungan-hidup',
  'kesehatan',
  'pertambangan',
  'perikanan',
  'pertanian',
  'peternakan',
  'perkebunan',
  'perbankan',
  'asuransi',
  'pasar-modal',
  'kepabeanan',
  'cukai',
  'senjata-tajam',
  'kependudukan',
  'ketenagakerjaan',
  'pendidikan',
  'telekomunikasi',
  'informasi-dan-transaksi-elektronik',
  'lalu-lintas',
  'perlindungan-konsumen',
]);

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s]+/g, '-');
}

export function normalizeCategory(
  document: IndoLawDocument,
  articles: readonly CaseArticleDraft[],
): CategoryResolution {
  const classification = normalizeSlug(document.classification);
  if (classification !== 'pidana-umum') {
    return {
      category: null,
      sourceLocation: null,
      coverageError: {
        code: 'not_general_criminal_case',
        detail: `klasifikasi=${document.classification || '(missing)'}`,
      },
      contradicted: false,
    };
  }

  if (articles.some((article) => isSpecialLawArticle(article))) {
    return {
      category: null,
      sourceLocation: null,
      coverageError: {
        code: 'special_law_charge',
        detail: 'indictment includes a special-law offence',
      },
      contradicted: false,
    };
  }

  const rawSlug = normalizeSlug(document.subClassification);
  const slug = CATEGORY_ALIASES.get(rawSlug) ?? rawSlug;
  if (SPECIAL_CATEGORIES.has(slug)) {
    return {
      category: null,
      sourceLocation: null,
      coverageError: {
        code: 'coverage_doubtful',
        detail: `sub_klasifikasi=${slug} is outside general criminal coverage`,
      },
      contradicted: false,
    };
  }

  if (UNKNOWN_CATEGORIES.has(slug) || !KNOWN_GENERAL_CATEGORIES.has(slug)) {
    return {
      category: null,
      sourceLocation: null,
      coverageError: null,
      contradicted: false,
    };
  }

  const families = new Set(
    articles
      .map((article) => articleFamily(article))
      .filter((family): family is string => family !== null),
  );

  if (families.size > 0 && !families.has(slug)) {
    return {
      category: null,
      sourceLocation: null,
      coverageError: null,
      contradicted: true,
    };
  }

  return {
    category: slug,
    sourceLocation: 'root@sub_klasifikasi',
    coverageError: null,
    contradicted: false,
  };
}
