import type { SkipCode } from './types';
import type { IndoLawDocument } from './xml';
import { collapseWhitespace } from './xml';

export interface DurationExpression {
  days: number;
  raw: string;
}

export type OutcomeResolution =
  | {
      ok: true;
      days: number;
      raw: string;
      location: string;
      kind: 'metadata' | 'metadata-and-verdict';
    }
  | { ok: false; code: SkipCode; detail: string };

const OUTCOME_BLOCKERS = /\b(?:bebas|lepas|seumur\s+hidup|pidana\s+mati|bersyarat)\b/;

const PROBATION_PATTERN =
  /\b(?:masa\s+percobaan|pidana\s+bersyarat|tidak\s+perlu\s+dijalani|pidana\s+pengawasan|dengan\s+masa\s+percobaan)\b/;

function normalizeNumbers(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert a written imprisonment duration to days using the agreed convention:
 * 1 year = 360 days, 1 month = 30 days, and days are added as written.
 * Detention periods and fine substitutes are deliberately not part of this
 * conversion.
 */
export function parseDurationExpression(text: string): DurationExpression | null {
  const flat = normalizeNumbers(text);
  const sentencePattern = /\b(?:pidana\s+penjara|penjara)\s+(?:selama\s+)?/g;

  for (const match of flat.matchAll(sentencePattern)) {
    const start = match.index ?? 0;
    const before = flat.slice(Math.max(0, start - 120), start);
    if (/\b(?:tuntutan|menuntut|dituntut|penuntut\s+umum)\b/.test(before)) {
      continue;
    }

    const immediateBefore = flat.slice(Math.max(0, start - 30), start);
    if (/\b(?:diancam|ancaman|paling\s+lama|paling\s+singkat)\b/.test(immediateBefore)) {
      continue;
    }

    const window = flat.slice(start, start + 220);
    const endMatch = window.match(
      /\b(?:denda|subsidair|kurungan|dikurangi|masa\s+penahanan|biaya\s+perkara|menetapkan|masa\s+percobaan|pidana\s+bersyarat|tidak\s+perlu\s+dijalani|pidana\s+pengawasan)\b/,
    );
    const segment = (endMatch?.index === undefined ? window : window.slice(0, endMatch.index)).trim();

    if (/\b(?:seumur|mati|bersyarat)\b/.test(segment)) {
      return null;
    }

    const units = new Map<string, number>();
    const unitPattern = /(\d+)\s+(?:[a-z]+\s+){0,4}?(tahun|bulan|hari)\b/g;
    for (const unitMatch of segment.matchAll(unitPattern)) {
      const amount = Number.parseInt(unitMatch[1] ?? '', 10);
      const unit = unitMatch[2];
      if (!Number.isSafeInteger(amount) || amount < 0 || unit === undefined) {
        continue;
      }
      units.set(unit, (units.get(unit) ?? 0) + amount);
    }

    if (units.size === 0) {
      continue;
    }

    const years = units.get('tahun') ?? 0;
    const months = units.get('bulan') ?? 0;
    const days = units.get('hari') ?? 0;

    return {
      days: years * 360 + months * 30 + days,
      raw: segment.replace(/\s+\d{1,2}$/, '').trim(),
    };
  }

  return null;
}

export function resolveOutcome(document: IndoLawDocument): OutcomeResolution {
  const metadataDays = document.metadataSentenceDays;
  const metadataRaw = document.metadataSentenceRaw;

  if (metadataDays === null || metadataDays <= 0) {
    return {
      ok: false,
      code: 'outcome_not_positive',
      detail: metadataRaw === null ? 'lama_hukuman is missing' : `lama_hukuman=${metadataRaw}`,
    };
  }

  const verdictText = collapseWhitespace([document.amar, document.amarOther].join(' ')).toLowerCase();
  if (OUTCOME_BLOCKERS.test(verdictText)) {
    return {
      ok: false,
      code: 'outcome_not_positive',
      detail: `non-finite or non-custodial outcome metadata: ${verdictText}`,
    };
  }

  const sectionOrder = ['amar_putusan', 'fakta', 'pertimbangan_hukum'] as const;
  const allVerdictText = sectionOrder
    .map((section) => document.sections[section] ?? '')
    .join(' ')
    .toLowerCase();
  if (PROBATION_PATTERN.test(allVerdictText)) {
    return {
      ok: false,
      code: 'outcome_not_positive',
      detail: 'suspended or probation sentence',
    };
  }

  for (const section of sectionOrder) {
    const text = document.sections[section];
    if (text === undefined) {
      continue;
    }
    const parsed = parseDurationExpression(text);
    if (parsed === null) {
      continue;
    }
    if (parsed.days !== metadataDays) {
      return {
        ok: false,
        code: 'outcome_conflict',
        detail: `lama_hukuman=${metadataDays} but ${section} says ${parsed.days} days`,
      };
    }
    return {
      ok: true,
      days: metadataDays,
      raw: parsed.raw,
      location: section,
      kind: 'metadata-and-verdict',
    };
  }

  return {
    ok: true,
    days: metadataDays,
    raw: metadataRaw ?? String(metadataDays),
    location: 'root@lama_hukuman',
    kind: 'metadata',
  };
}
