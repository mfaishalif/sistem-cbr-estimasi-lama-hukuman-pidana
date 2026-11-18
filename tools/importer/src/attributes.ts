import type { FactValue } from '@cbr/core';
import type { IndoLawDocument } from './xml';
import { collapseWhitespace } from './xml';

const MONTHS: Record<string, string> = {
  januari: '01',
  februari: '02',
  pebruari: '02',
  maret: '03',
  april: '04',
  mei: '05',
  juni: '06',
  juli: '07',
  agustus: '08',
  september: '09',
  oktober: '10',
  nopember: '11',
  november: '11',
  desember: '12',
};

const RELIGIONS = ['islam', 'kristen', 'katolik', 'hindu', 'budha', 'buddha', 'konghucu'];

function isoDate(day: string, monthName: string, year: string): string | null {
  const month = MONTHS[monthName.toLowerCase()];
  if (month === undefined) {
    return null;
  }
  const dayNumber = Number.parseInt(day, 10);
  const yearNumber = Number.parseInt(year, 10);
  if (dayNumber < 1 || dayNumber > 31 || yearNumber < 1900 || yearNumber > 2100) {
    return null;
  }
  return `${year}-${month}-${dayNumber.toString().padStart(2, '0')}`;
}

function identityText(document: IndoLawDocument): string {
  return collapseWhitespace(document.sections.identitas ?? '').toLowerCase();
}

function extractGender(text: string): string | null {
  const match = text.match(/\bjenis\s+kelamin\s+(laki\s+laki|perempuan)\b/);
  return match?.[1] === undefined ? null : match[1].replace(/\s+/g, '-');
}

function extractAge(text: string): { age: number; date: string } | null {
  const pattern = /(\d{1,2})\s+(?:tahun\s+)?(\d{1,2})\s+([a-z]+)\s+(\d{4})\b/g;
  for (const match of text.matchAll(pattern)) {
    const age = Number.parseInt(match[1] ?? '', 10);
    const date = isoDate(match[2] ?? '', match[3] ?? '', match[4] ?? '');
    if (date !== null && age >= 10 && age <= 100) {
      return { age, date };
    }
  }
  return null;
}

function extractReferenceDate(text: string): string | null {
  const patterns = [
    /\bditangkap(?:\s+pada)?\s+tanggal\s+(\d{1,2})\s+([a-z]+)\s+(\d{4})/,
    /\bditahan\b[^.]{0,90}?\bsejak\s+tanggal\s+(\d{1,2})\s+([a-z]+)\s+(\d{4})/,
    /\bsejak\s+tanggal\s+(\d{1,2})\s+([a-z]+)\s+(\d{4})/,
    /\bpenangkapan\s+tanggal\s+(\d{1,2})\s+([a-z]+)\s+(\d{4})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
      const date = isoDate(match[1], match[2], match[3]);
      if (date !== null) {
        return date;
      }
    }
  }
  return null;
}

function extractOccupationFromLabelList(text: string): string | null {
  const religionPattern = new RegExp(`\\b(?:${RELIGIONS.join('|')})\\b`);
  const religion = religionPattern.exec(text);
  if (religion?.index === undefined) {
    return null;
  }
  const afterReligion = text
    .slice(religion.index + religion[0].length)
    .replace(/^\s+/, '')
    .split(/\b(?:terdakwa|ditahan|ditangkap|dalam\s+tahanan)\b/)[0]
    ?.trim();
  if (afterReligion === undefined || afterReligion.length === 0) {
    return null;
  }
  const firstValue = afterReligion.split(/\s{2,}|\s+\d+\s+/)[0]?.trim();
  return firstValue !== undefined && firstValue.length >= 2 && firstValue.length <= 40
    ? firstValue
    : null;
}

function extractOccupation(text: string): string | null {
  if (/\b1\s+nama\s+lengkap\s+2\s+tempat\s+lahir\b/.test(text)) {
    return extractOccupationFromLabelList(text);
  }

  const match = text.match(
    /\bpekerjaan\s+([a-z][a-z ]{1,40}?)(?=\s+\d+\s+(?:pendidikan|agama|kebangsaan|tempat\s+tinggal)\b|\s+(?:terdakwa|ditahan|ditangkap|pendidikan)\b|$)/,
  );
  return match?.[1]?.trim() || null;
}

function extractEducation(text: string): string | null {
  const match = text.match(
    /\bpendidikan\s+([a-z][a-z ]{1,30}?)(?=\s+\d+\s+(?:pekerjaan|agama|kebangsaan|tempat\s+tinggal)\b|\s+(?:terdakwa|ditahan|ditangkap|pekerjaan)\b|$)/,
  );
  return match?.[1]?.trim() || null;
}

function extractPriorConviction(document: IndoLawDocument): 'yes' | 'no' | null {
  const text = collapseWhitespace(
    [document.sections.fakta, document.sections.riwayat_dakwaan]
      .filter((section): section is string => section !== undefined)
      .join(' '),
  ).toLowerCase();

  const negative = /\b(?:belum|tidak)\s+pernah\s+(?:di)?hukum\b/.exec(text);
  const positive = /\bpernah\s+(?:di)?hukum\b/.exec(text);
  if (negative !== null) {
    const before = text.slice(0, negative.index);
    if (/\b(?:memberatkan|meringankan)\b/.test(before)) {
      return null;
    }
    return 'no';
  }
  if (positive === null) {
    return null;
  }

  const before = text.slice(0, positive.index);
  if (/\b(?:memberatkan|meringankan)\b/.test(before)) {
    return null;
  }
  return 'yes';
}

function parseRupiah(raw: string): number | null {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 4) {
    return null;
  }
  const value = Number.parseInt(digits, 10);
  return Number.isSafeInteger(value) ? value : null;
}

function extractLossAmount(narrative: string): number | null {
  const match = narrative.match(
    /\bkerugian\s+(?:sebesar|senilai|sekitar|kurang\s+lebih)?\s*rp\s*([0-9][0-9 .,]{3,})/,
  );
  if (match?.[1] === undefined) {
    return null;
  }
  return parseRupiah(match[1]);
}

function extractRole(narrative: string): string | null {
  const match = narrative.match(
    /\bsebagai\s+(pelaku|turut\s+serta|pembantu|penyuruh|perantara|penadah)\b/,
  );
  return match?.[1]?.replace(/\s+/g, '-') ?? null;
}

function extractVictimHarm(narrative: string): string[] {
  const harm = new Set<string>();
  if (/\bluka\s+berat\b/.test(narrative)) {
    harm.add('luka-berat');
  }
  if (/\bluka\s+ringan\b/.test(narrative)) {
    harm.add('luka-ringan');
  }
  if (/\b(?:meninggal\s+dunia|korban\s+meninggal|mengakibatkan\s+kematian)\b/.test(narrative)) {
    harm.add('meninggal-dunia');
  }
  return [...harm].sort();
}

function extractWeaponOrMode(narrative: string): string[] {
  const modes = new Set<string>();
  if (/\bsenjata\s+api\b/.test(narrative)) {
    modes.add('senjata-api');
  }
  if (/\bsenjata\s+tajam\b/.test(narrative) || /\b(?:pisau|golok|parang|celurit|clurit)\b/.test(narrative)) {
    modes.add('senjata-tajam');
  }
  if (/\bbom\b/.test(narrative)) {
    modes.add('bom');
  }
  if (/\bracun\b/.test(narrative)) {
    modes.add('racun');
  }
  if (/\btipu\s+muslihat\b/.test(narrative)) {
    modes.add('tipu-muslihat');
  }
  if (/\bmembobol\b/.test(narrative)) {
    modes.add('membobol');
  }
  if (/\bmemanjat\b/.test(narrative)) {
    modes.add('memanjat');
  }
  return [...modes].sort();
}

function extractVictimCount(narrative: string): number | null {
  const patterns = [
    /\bkorban\s+(?:sebanyak\s+)?(\d{1,3})\s+orang\b/,
    /\b(\d{1,3})\s+orang\s+korban\b/,
  ];
  for (const pattern of patterns) {
    const match = narrative.match(pattern);
    if (match?.[1] !== undefined) {
      const value = Number.parseInt(match[1], 10);
      if (Number.isSafeInteger(value) && value > 0) {
        return value;
      }
    }
  }
  return null;
}

/**
 * Extract only attributes that are explicitly present and clearly attributable
 * to this defendant. Absence is represented by no attribute row, never by a
 * guessed zero, empty string, or "no".
 */
export function extractOptionalAttributes(
  document: IndoLawDocument,
  narrative: string,
): Record<string, FactValue> {
  const attributes: Record<string, FactValue> = {};
  const identity = identityText(document);

  const gender = extractGender(identity);
  if (gender !== null) {
    attributes.gender = {
      type: 'enum',
      value: gender,
      sourceLocation: 'identitas@jenis-kelamin',
    };
  }

  const age = extractAge(identity);
  const referenceDate = extractReferenceDate(identity);
  if (age !== null && referenceDate !== null) {
    attributes.age_years = {
      type: 'number',
      value: age.age,
      unit: 'tahun',
      sourceLocation: 'identitas@umur',
    };
    attributes.age_reference_date = {
      type: 'text',
      value: referenceDate,
      sourceLocation: 'identitas@penangkapan',
    };
  }

  const occupation = extractOccupation(identity);
  if (occupation !== null) {
    attributes.occupation = {
      type: 'text',
      value: occupation,
      sourceLocation: 'identitas@pekerjaan',
    };
  }

  const education = extractEducation(identity);
  if (education !== null) {
    attributes.education = {
      type: 'text',
      value: education,
      sourceLocation: 'identitas@pendidikan',
    };
  }

  const priorConviction = extractPriorConviction(document);
  if (priorConviction !== null) {
    attributes.prior_conviction = {
      type: 'enum',
      value: priorConviction,
      sourceLocation: 'fakta@riwayat-penghukuman',
    };
  }

  const lossAmount = extractLossAmount(narrative);
  if (lossAmount !== null) {
    attributes.loss_amount_idr = {
      type: 'number',
      value: lossAmount,
      unit: 'IDR',
      sourceLocation: 'narasi@kerugian',
    };
  }

  const victimCount = extractVictimCount(narrative);
  if (victimCount !== null) {
    attributes.victim_count = {
      type: 'number',
      value: victimCount,
      unit: 'orang',
      sourceLocation: 'narasi@korban',
    };
  }

  const role = extractRole(narrative);
  if (role !== null) {
    attributes.role = {
      type: 'enum',
      value: role,
      sourceLocation: 'narasi@peran',
    };
  }

  const victimHarm = extractVictimHarm(narrative);
  if (victimHarm.length > 0) {
    attributes.victim_harm = {
      type: 'set',
      value: JSON.stringify(victimHarm),
      sourceLocation: 'narasi@akibat',
    };
  }

  const weaponOrMode = extractWeaponOrMode(narrative);
  if (weaponOrMode.length > 0) {
    attributes.weapon_or_mode = {
      type: 'set',
      value: JSON.stringify(weaponOrMode),
      sourceLocation: 'narasi@alat-cara',
    };
  }

  return attributes;
}
