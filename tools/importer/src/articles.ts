import type { ArticleArrangement, CaseArticleDraft } from '@cbr/core';
import type { IndoLawDocument } from './xml';
import { collapseWhitespace } from './xml';

interface ArticleMatch {
  article: string;
  paragraph: string | null;
  index: number;
  raw: string;
}

function parseArticleMatches(text: string): ArticleMatch[] {
  const matches: ArticleMatch[] = [];
  const pattern = /\bpasal\s+(\d{1,4})(?:\s+ayat\s+\(?(\d+)\)?)?(?:\s+huruf\s+([a-z]))?/g;

  for (const match of text.matchAll(pattern)) {
    const article = match[1];
    if (article === undefined) {
      continue;
    }
    matches.push({
      article,
      paragraph: match[2] ?? null,
      index: match.index ?? 0,
      raw: match[0],
    });
  }

  return matches;
}

function arrangementFromContext(before: string): ArticleArrangement {
  const context = before.slice(-140);
  if (/\bsubsidair\b/.test(context)) {
    return 'subsidiary';
  }
  if (/\b(?:alternatif|atau\s+(?:kedua|ketiga|keempat|kelima))\b/.test(context)) {
    return 'alternative';
  }
  return 'primary';
}

function lawFromContext(before: string, after: string): string | null {
  if (/\b(?:kuhp|kitab\s+undang\s+undang\s+hukum\s+pidana)\b/.test(after)) {
    return 'KUHP';
  }
  if (/\b(?:kuhp|kitab\s+undang\s+undang\s+hukum\s+pidana)\b/.test(before)) {
    return 'KUHP';
  }

  const specialLaw = after.match(
    /\b(?:uu|undang\s+undang)\s+(?:ri\s+)?(?:no|nomor)?\s*(\d{1,3})\s+tahun\s+(\d{4})\s+tentang\s+([a-z ]{3,80})/,
  );
  if (specialLaw?.[1] !== undefined && specialLaw[2] !== undefined) {
    const title = (specialLaw[3] ?? '').trim();
    if (/\b(?:kuhap|hukum\s+acara\s+pidana)\b/.test(title)) {
      return null;
    }
    return `UU ${specialLaw[1]}/${specialLaw[2]}`;
  }

  return null;
}

export function extractIndictmentArticles(document: IndoLawDocument): CaseArticleDraft[] {
  const rawSection = document.sections.riwayat_dakwaan;
  if (rawSection === undefined) {
    return [];
  }

  const text = collapseWhitespace(rawSection)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const articles: CaseArticleDraft[] = [];
  const seen = new Set<string>();

  for (const match of parseArticleMatches(text)) {
    const before = text.slice(Math.max(0, match.index - 180), match.index);
    const after = text.slice(match.index, match.index + 180);
    const law = lawFromContext(before, after);
    if (law === null) {
      continue;
    }

    if (/\b(?:kuhap|hukum\s+acara\s+pidana)\b/.test(after)) {
      continue;
    }

    const arrangement = arrangementFromContext(before);
    const key = `${law}|${match.article}|${match.paragraph ?? ''}|${arrangement}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    articles.push({
      law,
      article: match.article,
      paragraph: match.paragraph,
      arrangement,
      rawText: collapseWhitespace(after.slice(0, 180)),
      sourceLocation: `riwayat_dakwaan@pasal-${match.article}`,
    });
  }

  return articles;
}

function kuhpFamily(article: number): string | null {
  if (article >= 153 && article <= 181) return 'kejahatan-terhadap-keteriban-umum';
  if (article >= 242 && article <= 243) return 'sumpah-palsu-dan-keterangan-palsu';
  if (article >= 244 && article <= 252) return 'mata-uang';
  if (article >= 263 && article <= 276) return 'pemalsuan';
  if (article >= 277 && article <= 280) return 'kejahatan-terhadap-asal-usul-perkawinan';
  if (article >= 281 && article <= 303) return 'kejahatan-terhadap-kesusilaan';
  if (article >= 310 && article <= 321) return 'penghinaan';
  if (article >= 328 && article <= 337) return 'kejahatan-terhadap-kemerdekaan-orang-lain';
  if (article >= 338 && article <= 350) return 'pembunuhan';
  if (article >= 351 && article <= 358) return 'penganiayaan';
  if (article >= 359 && article <= 361) return 'kealfaan-mengakibatkan-kematianluka';
  if (article >= 362 && article <= 367) return 'pencurian';
  if (article >= 368 && article <= 369) return 'pemerasan-dan-pengancaman';
  if (article >= 372 && article <= 377) return 'penggelapan';
  if (article >= 378 && article <= 395) return 'penipuan';
  if (article >= 406 && article <= 412) return 'perusakan';
  if (article >= 480 && article <= 482) return 'penadahan';
  return null;
}

export function articleFamily(article: CaseArticleDraft): string | null {
  const law = article.law.toLowerCase();
  const context = `${law} ${(article.rawText ?? '').toLowerCase()}`;
  const number = Number.parseInt(article.article.replace(/[^0-9]/g, ''), 10);
  if (!Number.isSafeInteger(number)) {
    return null;
  }

  if (law === 'kuhp') {
    return kuhpFamily(number);
  }

  if (/\blalu\s+lintas\b/.test(context) && number === 310) {
    return 'kealfaan-mengakibatkan-kematianluka';
  }

  return null;
}

/**
 * Law numbers that belong to special criminal law. Matching the number/year
 * pair avoids relying on a title that OCR or truncation may have dropped.
 */
const SPECIAL_LAW_REFERENCES = new Set([
  'uu 35/2009',
  'uu 22/1997',
  'uu 5/1997',
  'uu 31/1999',
  'uu 20/2001',
  'uu 15/2003',
  'uu 5/2018',
  'uu 8/2010',
  'uu 15/2002',
  'uu 23/2002',
  'uu 35/2014',
  'uu 17/2016',
  'uu 23/2004',
  'uu 11/2008',
  'uu 19/2016',
  'uu 21/2007',
]);

export function isSpecialLawArticle(article: CaseArticleDraft): boolean {
  if (SPECIAL_LAW_REFERENCES.has(article.law.toLowerCase())) {
    return true;
  }
  return /\b(?:narkotika|psikotropika|korupsi|terorisme|pencucian\s+uang|perlindungan\s+anak|kekerasan\s+dalam\s+rumah\s+tangga)\b/.test(
    `${article.law} ${article.rawText ?? ''}`.toLowerCase(),
  );
}
