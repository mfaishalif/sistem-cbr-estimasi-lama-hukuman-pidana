import type { CaseIdentity } from './identity';
import type { SkipCode } from './types';
import type { IndoLawDocument, SectionTag } from './xml';
import { collapseWhitespace } from './xml';

export type NarrativeResolution =
  | { ok: true; text: string; location: SectionTag }
  | { ok: false; code: SkipCode; detail: string };

const LEAK_MARKERS: readonly RegExp[] = [
  /\bmenimbang\s+bahwa\s+atas\s+pembacaan\s+surat\s+dakwaan\b/,
  /\bmenimbang\s+bahwa\s+untuk\s+membuktikan\s+dakwaan\b/,
  /\bmenimbang\s+bahwa\s+terhadap\s+(?:dakwaan|surat\s+dakwaan)\b/,
  /\bmenimbang\s+bahwa\s+selanjutnya\b/,
  /\bmenimbang\s+bahwa\s+di\s+persidangan\b/,
  /\bmenimbang\s+bahwa\s+dari\s+keterangan\s+saksi\b/,
  /\bmenimbang\s+bahwa\s+berdasarkan\s+fakta\b/,
  /\bmenimbang\s+bahwa\s+selama\s+pemeriksaan\b/,
  /\bmenimbang\s+bahwa\s+sebelum\s+menjatuhkan\b/,
  /\bmenimbang\s+bahwa\s+karena\s+terdakwa\s+ditahan\b/,
  /\bmenimbang\s+bahwa\s+mengenai\s+barang\s+bukti\b/,
  /\bmengingat\s+pasal\b/,
  /\bmengadili\b/,
  /\bmenyatakan\s+terdakwa\b/,
  /\bmenjatuhkan\s+pidana\b/,
  /\bpidana\s+penjara\s+selama\b/,
  /\btuntutan(?:nya)?\s+(?:pidana|penuntut\s+umum|yang\s+disampaikan)\b/,
  /\btelah\s+mendengar(?:kan)?\s+(?:keterangan|tuntutan|pembelaan|tanggapan|replik|duplik|pembacaan)\b/,
  /\bsetelah\s+mendengar\b/,
  /\bmenuntut\s+agar\b/,
  /\btetap\s+pada\s+tuntutan(?:nya)?\b/,
  /\breplik(?:nya)?\b/,
  /\bduplik(?:nya)?\b/,
  /\b(?:nota\s+)?pembelaan(?:nya)?\b/,
  /\btanggapan\s+(?:penuntut\s+umum|atas\s+pembelaan)\b/,
  /\bsurat\s+tuntutan(?:nya)?\b/,
  /\btuntutan\s+kami\b/,
  /\bmajelis\s+hakim\b/,
  /\bsependapat\s+dengan\s+uraian\s+tuntutan\b/,
  /\b(?:para\s+)?terdakwa\s+telah\s+terbukti\b/,
  /\bterbukti\s+melakukan\b/,
  /\bmenyatakan\s+bahwa\s+para\s+terdakwa\b/,
  /\bpenuntut\s+umum\s+telah\s+mengajukan\b/,
  /\bhal\s+(?:hal\s+)?yang\s+(?:memberatkan|meringankan)\b/,
  /\bkeadaan\s+yang\s+(?:memberatkan|meringankan)\b/,
  /\bhal\s+hal\s+yang\s+memberatkan\b/,
  /\bhal\s+yang\s+memberatkan\b/,
  /\bterbukti\s+secara\s+sah\b/,
  /\bamar\b/,
  /\bputusan\s+sela\b/,
  /\beksepsi\b/,
  /\bdemikianlah\s+diputus\b/,
  /\bamar\s+putusan\b/,
  /\bpertimbangan\s+hukum\b/,
];

const BOILERPLATE_PREFIXES: readonly RegExp[] = [
  /^menimbang\s+bahwa\s+terdakwa\s+(?:diajukan|dihadapkan)\s+ke\s+persidangan\s+oleh\s+penuntut\s+umum\s+(?:telah\s+melakukan\s+tindak\s+pidana\s+sebagaimana\s+diatur\s+dan\s+diancam\s+pidana\s+dalam\s+dakwaan\s+)?(?:didakwa\s+berdasarkan\s+surat\s+dakwaan\s+)?(?:sebagai\s+berikut\s+)?/,
  /^menimbang\s+bahwa\s+terdakwa\s+telah\s+didakwa\s+melakukan\s+tindak\s+pidana\s+sebagaimana\s+diuraikan\s+dalam\s+surat\s+dakwaan\s+penuntut\s+umum(?:\s+nomor\s+[a-z0-9 ]+)?(?:\s+tanggal\s+\d+)?(?:\s+yang\s+pada\s+pokoknya\s+sebagai\s+berikut)?/,
  /^menimbang\s+bahwa\s+terdakwa\s+dihadapkan\s+ke\s+persidangan\s+oleh\s+penuntut\s+umum\s+telah\s+melakukan\s+tindak\s+pidana\s+sebagaimana\s+diatur\s+dan\s+diancam\s+pidana\s+dalam\s+dakwaan/,
];

const RESIDUAL_OUTCOME_PATTERNS: readonly RegExp[] = [
  /\b(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|dua\s+belas)\s+(?:tahun|bulan)\b/,
  /\b\d+\s+(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|dua\s+belas)\s+(?:tahun|bulan)\b/,
  /\b\d+\s+(?:tahun|bulan)\b/,
  /\bpidana\s+penjara\b/,
  /\bdijatuhi\s+pidana\b/,
  /\bmenjatuhkan\s+pidana\b/,
  /\b(?:telah\s+)?terbukti\b/,
  /\bmenuntut\b/,
  /\btuntutan(?:nya)?\b/,
  /\breplik(?:nya)?\b/,
  /\bduplik(?:nya)?\b/,
  /\b(?:nota\s+)?pembelaan(?:nya)?\b/,
  /\bmajelis\s+hakim\b/,
];

function stripBoilerplate(text: string): string {
  let result = text;
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of BOILERPLATE_PREFIXES) {
      const next = result.replace(pattern, '').trim();
      if (next !== result) {
        result = next;
        changed = true;
      }
    }
  }
  return result;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactIdentity(text: string, identity: CaseIdentity): string {
  let result = text;

  const fullName = identity.defendantName.toLowerCase();
  if (fullName.length >= 2) {
    result = result.replace(
      new RegExp(`\\bterdakwa\\s+${escapeRegExp(fullName)}\\b`, 'g'),
      '[terdakwa]',
    );
    result = result.replace(new RegExp(escapeRegExp(fullName), 'g'), '[terdakwa]');
  }

  const nameParts = fullName
    .split(/\b(?:alias|als|bin|binti)\b/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
  for (const part of nameParts) {
    result = result.replace(new RegExp(`\\b${escapeRegExp(part)}\\b`, 'g'), '[terdakwa]');
  }

  const caseParts = identity.caseNumber.toLowerCase().split('/');
  if (caseParts.length >= 3) {
    const number = caseParts[0];
    const type = caseParts[1]?.replace(/\./g, ' ');
    const year = caseParts[2];
    if (number !== undefined && type !== undefined && year !== undefined) {
      result = result.replace(
        new RegExp(`\\bnomor\\s+${number}\\s+${type}\\s+${year}\\s+[a-z .]{1,30}\\b`, 'g'),
        '[nomor perkara]',
      );
      result = result.replace(
        new RegExp(`\\b${number}\\s+${type}\\s+${year}\\b`, 'g'),
        '[nomor perkara]',
      );
    }
  }

  result = result.replace(/\bhttps?:\/\/\S+\b/g, '[url]');
  result = result.replace(/\bpengadilan\s+negeri\s+[a-z .]{2,40}\b/g, '[pengadilan]');
  result = result.replace(new RegExp(escapeRegExp(identity.court.toLowerCase()), 'g'), '[pengadilan]');

  return collapseWhitespace(result);
}

export function sanitizeNarrative(
  raw: string,
  identity: CaseIdentity,
): { ok: true; text: string } | { ok: false; code: SkipCode; detail: string } {
  let text = collapseWhitespace(raw).toLowerCase();
  if (text.length === 0) {
    return { ok: false, code: 'narrative_too_short', detail: 'section is empty' };
  }

  let cutIndex = text.length;
  for (const marker of LEAK_MARKERS) {
    const match = marker.exec(text);
    if (match?.index !== undefined) {
      cutIndex = Math.min(cutIndex, match.index);
    }
  }
  text = text.slice(0, cutIndex).trim();

  text = stripBoilerplate(text);

  for (const pattern of RESIDUAL_OUTCOME_PATTERNS) {
    if (pattern.test(text)) {
      return {
        ok: false,
        code: 'narrative_contains_outcome',
        detail: `residual outcome marker ${pattern}`,
      };
    }
  }

  text = redactIdentity(text, identity);

  if (text.length < 120) {
    return {
      ok: false,
      code: 'narrative_too_short',
      detail: `safe narrative is ${text.length} characters`,
    };
  }

  return { ok: true, text };
}

export function buildNarrative(
  document: IndoLawDocument,
  identity: CaseIdentity,
): NarrativeResolution {
  const candidates: SectionTag[] = ['riwayat_dakwaan', 'fakta'];
  let firstError: { code: SkipCode; detail: string } | null = null;

  for (const section of candidates) {
    const raw = document.sections[section];
    if (raw === undefined) {
      continue;
    }
    const sanitized = sanitizeNarrative(raw, identity);
    if (sanitized.ok) {
      return { ok: true, text: sanitized.text, location: section };
    }
    if (firstError === null) {
      firstError = { code: sanitized.code, detail: `${section}: ${sanitized.detail}` };
    }
  }

  if (firstError !== null) {
    return { ok: false, ...firstError };
  }

  return {
    ok: false,
    code: 'narrative_not_separable',
    detail: 'no indictment or fact section is available',
  };
}
