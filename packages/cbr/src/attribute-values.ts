/**
 * Canonical values for the two free-text attributes that are compared
 * categorically. Import, API writes, and comparisons all call this module so a
 * value written as "SLTA" and a value entered as "SMA" meet the same key.
 *
 * Meaningful values outside the known aliases are kept: the goal is to remove
 * extraction noise, not to force every answer into a closed vocabulary.
 */

const UNKNOWN_MARKERS = new Set([
  'tidak diketahui',
  'tidak-diketahui',
  'belum diketahui',
  'belum-diketahui',
  'tidak ada',
  'tidak ada data',
  'tidak tercatat',
  'tidak terisi',
  'tidak diisi',
  'tidak jelas',
  'kosong',
  'unknown',
  'n/a',
  'na',
  'none',
  'null',
]);

const EDUCATION_ALIASES: Record<string, string> = {
  'tidak sekolah': 'tidak-sekolah',
  'belum sekolah': 'tidak-sekolah',
  'tidak pernah sekolah': 'tidak-sekolah',
  sd: 'sd',
  's d': 'sd',
  'sekolah dasar': 'sd',
  'sekolah rakyat': 'sd',
  sr: 'sd',
  'sd tamat': 'sd',
  'tamat sd': 'sd',
  'lulus sd': 'sd',
  'sd negeri': 'sd',
  'sd swasta': 'sd',
  smp: 'smp',
  sltp: 'smp',
  's m p': 'smp',
  'sekolah lanjutan pertama': 'smp',
  'sekolah menengah pertama': 'smp',
  'smp tamat': 'smp',
  'tamat smp': 'smp',
  'lulus smp': 'smp',
  'smp negeri': 'smp',
  'smp swasta': 'smp',
  sma: 'sma',
  slta: 'sma',
  smu: 'sma',
  's m a': 'sma',
  'sekolah lanjutan atas': 'sma',
  'sekolah menengah atas': 'sma',
  'sma tamat': 'sma',
  'tamat sma': 'sma',
  'lulus sma': 'sma',
  'slta tamat': 'sma',
  'smu tamat': 'sma',
  'sma negeri': 'sma',
  'sma swasta': 'sma',
  diploma: 'diploma',
  d1: 'diploma',
  d2: 'diploma',
  d3: 'diploma',
  d4: 'diploma',
  'diploma i': 'diploma',
  'diploma ii': 'diploma',
  'diploma iii': 'diploma',
  'diploma iv': 'diploma',
  akademi: 'diploma',
  sarjana: 'sarjana',
  s1: 'sarjana',
  's-1': 'sarjana',
  'strata 1': 'sarjana',
  'strata satu': 'sarjana',
  pascasarjana: 'pascasarjana',
  'pasca sarjana': 'pascasarjana',
  s2: 'pascasarjana',
  s3: 'pascasarjana',
  's-2': 'pascasarjana',
  's-3': 'pascasarjana',
  magister: 'pascasarjana',
  doktor: 'pascasarjana',
  'strata 2': 'pascasarjana',
  'strata 3': 'pascasarjana',
};

const OCCUPATION_ALIASES: Record<string, string> = {
  tani: 'petani',
  'karyawan swasta': 'swasta',
  'pegawai swasta': 'swasta',
};

/** Lowercase, collapse whitespace, and drop punctuation-only padding. */
function canonicalText(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, ' ')
    .trim()
    .replace(/^[\s\-–—.,;:/]+|[\s\-–—.,;:/]+$/g, '')
    .trim();
}

function isUnknownOrInvalid(text: string): boolean {
  if (text === '') {
    return true;
  }
  if (text === 'terdakwa' || text.startsWith('terdakwa ')) {
    return true;
  }
  return UNKNOWN_MARKERS.has(text);
}

function aliasLookupKey(text: string): string {
  return text.replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

export function normalizeEducation(raw: string): string | null {
  const text = canonicalText(raw);
  if (isUnknownOrInvalid(text)) {
    return null;
  }
  const key = aliasLookupKey(text);
  return Object.hasOwn(EDUCATION_ALIASES, key) ? EDUCATION_ALIASES[key] ?? text : text;
}

export function normalizeOccupation(raw: string): string | null {
  const text = canonicalText(raw);
  if (isUnknownOrInvalid(text)) {
    return null;
  }
  const key = aliasLookupKey(text);
  return Object.hasOwn(OCCUPATION_ALIASES, key) ? OCCUPATION_ALIASES[key] ?? text : text;
}

/**
 * One entry point for every attribute value. Only education and occupation
 * carry aliases; other text attributes get the same basic whitespace cleanup.
 */
export function normalizeAttributeValue(key: string, raw: string): string | null {
  if (key === 'education') {
    return normalizeEducation(raw);
  }
  if (key === 'occupation') {
    return normalizeOccupation(raw);
  }
  return raw.trim().toLowerCase().replace(/\s+/g, ' ') || null;
}
