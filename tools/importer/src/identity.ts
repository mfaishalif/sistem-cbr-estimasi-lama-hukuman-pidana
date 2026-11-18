import type { IndoLawDocument } from './xml';
import { collapseWhitespace } from './xml';

export interface CaseIdentity {
  court: string;
  caseNumber: string;
  courtNormalized: string;
  caseNumberNormalized: string;
  defendantName: string;
  defendantNormalized: string;
}

export class IdentityError extends Error {
  constructor(
    readonly code:
      | 'court_missing'
      | 'case_number_missing'
      | 'defendant_identity_missing'
      | 'multiple_defendants',
    message: string,
  ) {
    super(message);
    this.name = 'IdentityError';
  }
}

/** Identity matching is case-insensitive and ignores punctuation/spacing. */
export function normalizeCasePart(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function courtDisplayFromSlug(slug: string): string | null {
  const trimmed = slug.trim().toLowerCase();
  if (trimmed.length === 0) {
    return null;
  }

  const parts = trimmed.split('-').filter((part) => part.length > 0);
  if (parts[0] === 'pn') {
    return `PN ${titleCase(parts.slice(1).join(' '))}`.trim();
  }
  if (parts[0] === 'pengadilan' && parts[1] === 'negeri') {
    return `Pengadilan Negeri ${titleCase(parts.slice(2).join(' '))}`.trim();
  }

  return titleCase(parts.join(' '));
}

function courtDisplayFromHead(head: string): string | null {
  const flat = collapseWhitespace(head).toLowerCase();
  const match = flat.match(
    /pengadilan\s+negeri\s+([a-z][a-z .]{1,60}?)(?=\s+(?:yang|dalam|kelas|khusus|dengan)\b|$)/,
  );
  if (match?.[1] === undefined) {
    return null;
  }
  return `PN ${titleCase(match[1])}`;
}

function caseTypeDisplay(raw: string): string {
  const tokens = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  return tokens.map((token) => token.charAt(0).toUpperCase() + token.slice(1)).join('.');
}

interface ParsedCaseNumber {
  number: string;
  type: string;
  year: string;
}

function parseCaseNumber(head: string): ParsedCaseNumber | null {
  const flat = collapseWhitespace(head)
    .replace(/[./]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const withPrefix = flat.match(
    /nomor\s+(\d{1,4})\s+([a-z][a-z0-9 ]{0,24}?)\s+(\d{4})\s+[a-z]/,
  );
  if (withPrefix?.[1] !== undefined && withPrefix[2] !== undefined && withPrefix[3] !== undefined) {
    return {
      number: withPrefix[1],
      type: withPrefix[2].trim(),
      year: withPrefix[3],
    };
  }

  const withoutPrefix = flat.match(/(\d{1,4})\s+(pid\s+[a-z0-9 ]{1,16}?)\s+(\d{4})\b/);
  if (
    withoutPrefix?.[1] !== undefined &&
    withoutPrefix[2] !== undefined &&
    withoutPrefix[3] !== undefined
  ) {
    return {
      number: withoutPrefix[1],
      type: withoutPrefix[2].trim(),
      year: withoutPrefix[3],
    };
  }

  return null;
}

function cleanDefendantName(raw: string): string | null {
  const name = collapseWhitespace(raw)
    .toLowerCase()
    .replace(/^(?:ia|para)\s+/, '')
    .replace(/^terdakwa\s+/, '')
    .replace(/\s+tersebut\s+di\s+atas$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (name.length < 2 || name.length > 90) {
    return null;
  }
  if (/\b(?:dan\s+terdakwa|para\s+terdakwa|tersebut|adalah|dalam|perkara|ini|oleh|dengan)\b/.test(name)) {
    return null;
  }
  if (!/[a-z]/.test(name)) {
    return null;
  }

  return name;
}

const defendantPatterns = [
  /\bbahwa\s+(?:ia\s+)?terdakwa\s+([a-z][a-z .]{2,80}?)\s+(?:pada|telah|dengan|yang|selaku)\b/,
  /\bmenyatakan\s+(?:terdakwa\s+)?([a-z][a-z .]{2,80}?)\s+(?:tersebut\s+di\s+atas\s+)?(?:terbukti|telah\s+terbukti)\b/,
  /\bmenjatuhkan\s+pidana\s+kepada\s+(?:terdakwa\s+)?([a-z][a-z .]{2,80}?)\s+dengan\s+pidana\s+penjara\b/,
] as const;

export function extractDefendantName(document: IndoLawDocument): string | null {
  const texts = [
    document.sections.riwayat_dakwaan,
    document.sections.identitas,
    document.sections.amar_putusan,
    document.sections.kepala_putusan,
  ].filter((text): text is string => text !== undefined);

  for (const text of texts) {
    const normalized = collapseWhitespace(text).toLowerCase();
    for (const pattern of defendantPatterns) {
      for (const match of normalized.matchAll(new RegExp(pattern.source, 'g'))) {
        if (match[1] === undefined) {
          continue;
        }
        const name = cleanDefendantName(match[1]);
        if (name !== null) {
          return name;
        }
      }
    }
  }

  return null;
}

export function detectMultipleDefendants(document: IndoLawDocument): boolean {
  const identityText = collapseWhitespace(
    [document.sections.identitas, document.sections.kepala_putusan, document.sections.riwayat_dakwaan]
      .filter((text): text is string => text !== undefined)
      .join(' '),
  ).toLowerCase();

  const numberedOne = /\bterdakwa\s+(?:i|1)\b/.test(identityText);
  const numberedTwo = /\bterdakwa\s+(?:ii|2)\b/.test(identityText);
  if (numberedOne && numberedTwo) {
    return true;
  }

  const sentences = collapseWhitespace(document.sections.amar_putusan ?? '').toLowerCase();
  const namedSentences = new Set<string>();
  const pattern =
    /\bterdakwa\s+([a-z][a-z .]{2,60}?)\s+dengan\s+pidana\s+penjara\b/g;
  for (const match of sentences.matchAll(pattern)) {
    const name = cleanDefendantName(match[1] ?? '');
    if (name !== null) {
      namedSentences.add(normalizeCasePart(name));
    }
  }

  return namedSentences.size > 1;
}

/**
 * Find explicitly cited case numbers in procedural sections. Only exact
 * court+number/year citations are returned; shared names or categories are
 * never treated as a relationship.
 */
export function extractRelatedCaseKeys(
  document: IndoLawDocument,
  identity: CaseIdentity,
): string[] {
  const text = collapseWhitespace(
    [document.sections.riwayat_perkara, document.sections.penutup]
      .filter((section): section is string => section !== undefined)
      .join(' '),
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const keys = new Set<string>();
  const pattern =
    /\b(?:perkara\s+(?:lain\s+)?)?nomor\s+(\d{1,4})\s+([a-z][a-z0-9 ]{0,24}?)\s+(\d{4})\s+(pn\s+[a-z .]{1,40}?)(?=\s|$)/g;

  for (const match of text.matchAll(pattern)) {
    const number = match[1];
    const type = match[2]?.trim();
    const year = match[3];
    const courtText = match[4]?.trim();
    if (number === undefined || type === undefined || year === undefined || courtText === undefined) {
      continue;
    }
    const casePart = normalizeCasePart(`${number} ${type} ${year}`);
    if (casePart === identity.caseNumberNormalized) {
      continue;
    }
    // Court abbreviations in citations (for example "pn jkt pst") cannot be
    // canonicalized to the slug-derived court safely. Related cases are
    // therefore matched within the document's own court.
    keys.add(`${identity.courtNormalized}|${casePart}`);
  }

  return [...keys].sort();
}

export function extractCaseIdentity(document: IndoLawDocument): CaseIdentity {
  const head = document.sections.kepala_putusan ?? '';
  const court = courtDisplayFromSlug(document.courtSlug) ?? courtDisplayFromHead(head);
  if (court === null) {
    throw new IdentityError('court_missing', 'court identity is missing');
  }

  const parsedCaseNumber = parseCaseNumber(head);
  if (parsedCaseNumber === null) {
    throw new IdentityError('case_number_missing', 'case number is missing from the verdict head');
  }

  const multipleDefendants = detectMultipleDefendants(document);
  if (multipleDefendants) {
    throw new IdentityError(
      'multiple_defendants',
      'document contains multiple defendants without a reliably separable outcome',
    );
  }

  const defendantName = extractDefendantName(document);
  if (defendantName === null) {
    throw new IdentityError('defendant_identity_missing', 'defendant identity is missing');
  }

  const typeDisplay = caseTypeDisplay(parsedCaseNumber.type);
  const caseNumber = `${parsedCaseNumber.number}/${typeDisplay}/${parsedCaseNumber.year}/${court}`;

  return {
    court,
    caseNumber,
    courtNormalized: normalizeCasePart(court),
    caseNumberNormalized: normalizeCasePart(
      `${parsedCaseNumber.number} ${parsedCaseNumber.type} ${parsedCaseNumber.year}`,
    ),
    defendantName,
    defendantNormalized: normalizeCasePart(defendantName),
  };
}
