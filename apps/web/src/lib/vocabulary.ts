/**
 * Display vocabulary for slugs stored in the case base.
 *
 * TEMPORARY: categories are hardcoded until the backend exposes
 * `GET /api/vocabulary` (see docs/frontend/backend-requests.md). The slugs are
 * sent to the API exactly as they appear in Indo-Law, including the typos
 * `keteriban` and `kematianluka`; only the labels are tidied.
 */

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

export const CATEGORIES: Option[] = [
  { value: 'pencurian', label: 'Pencurian' },
  { value: 'penggelapan', label: 'Penggelapan' },
  { value: 'penipuan', label: 'Penipuan' },
  { value: 'penganiayaan', label: 'Penganiayaan' },
  { value: 'pembunuhan', label: 'Pembunuhan' },
  { value: 'penghinaan', label: 'Penghinaan' },
  { value: 'penadahan', label: 'Penadahan' },
  { value: 'kejahatan-terhadap-keamanan-negara', label: 'Kejahatan terhadap keamanan negara' },
  { value: 'pemalsuan', label: 'Pemalsuan' },
  { value: 'pemerasan-dan-pengancaman', label: 'Pemerasan dan pengancaman' },
  {
    value: 'kealfaan-mengakibatkan-kematianluka',
    label: 'Kealpaan yang mengakibatkan kematian atau luka',
  },
  { value: 'kejahatan-terhadap-kesusilaan', label: 'Kejahatan terhadap kesusilaan' },
  { value: 'perjudian', label: 'Perjudian' },
  { value: 'kejahatan-terhadap-keteriban-umum', label: 'Kejahatan terhadap ketertiban umum' },
  { value: 'perusakan', label: 'Perusakan' },
  { value: 'lalu-lintas', label: 'Lalu lintas' },
  { value: 'mata-uang', label: 'Mata uang' },
  { value: 'senjata-api', label: 'Senjata api' },
  { value: 'kehutanan', label: 'Kehutanan' },
  {
    value: 'kejahatan-terhadap-kemerdekaan-orang-lain',
    label: 'Kejahatan terhadap kemerdekaan orang lain',
  },
];

export const GENDERS: Option[] = [
  { value: 'laki-laki', label: 'Laki-laki' },
  { value: 'perempuan', label: 'Perempuan' },
];

export const PRIOR_CONVICTION: Option<'yes' | 'no'>[] = [
  { value: 'yes', label: 'Pernah' },
  { value: 'no', label: 'Belum pernah' },
];

export const ROLES: Option[] = [
  { value: 'pelaku', label: 'Pelaku' },
  { value: 'turut-serta', label: 'Turut serta' },
  { value: 'pembantu', label: 'Pembantu' },
  { value: 'penyuruh', label: 'Penyuruh' },
  { value: 'perantara', label: 'Perantara' },
  { value: 'penadah', label: 'Penadah' },
];

export const VICTIM_HARM: Option[] = [
  { value: 'luka-ringan', label: 'Luka ringan' },
  { value: 'luka-berat', label: 'Luka berat' },
  { value: 'meninggal-dunia', label: 'Meninggal dunia' },
];

export const WEAPON_OR_MODE: Option[] = [
  { value: 'senjata-tajam', label: 'Senjata tajam' },
  { value: 'senjata-api', label: 'Senjata api' },
  { value: 'bom', label: 'Bom' },
  { value: 'racun', label: 'Racun' },
  { value: 'tipu-muslihat', label: 'Tipu muslihat' },
  { value: 'membobol', label: 'Membobol' },
];

export const ARRANGEMENTS: Option<'primary' | 'alternative' | 'subsidiary'>[] = [
  { value: 'primary', label: 'Primer' },
  { value: 'alternative', label: 'Alternatif' },
  { value: 'subsidiary', label: 'Subsidair' },
];

export const ATTRIBUTE_LABELS: Record<string, string> = {
  age_years: 'Umur',
  age_reference_date: 'Tanggal penangkapan',
  gender: 'Jenis kelamin',
  occupation: 'Pekerjaan',
  education: 'Pendidikan',
  role: 'Peran',
  victim_count: 'Jumlah korban',
  victim_harm: 'Akibat pada korban',
  loss_amount_idr: 'Kerugian',
  weapon_or_mode: 'Cara atau alat',
  prior_conviction: 'Riwayat dihukum',
};

/** Turn an unknown slug into readable text: "turut-serta" → "Turut serta". */
export function humanizeSlug(slug: string): string {
  const text = slug.replace(/[-_]+/g, ' ').trim();
  return text === '' ? slug : text.charAt(0).toUpperCase() + text.slice(1);
}

export function labelFor(options: readonly Option[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? humanizeSlug(value);
}

export function categoryLabel(slug: string | null | undefined): string | null {
  if (slug === null || slug === undefined || slug.trim() === '') {
    return null;
  }
  return labelFor(CATEGORIES, slug);
}

/** Lower-case form for running text: "kategori pencurian". */
export function categoryPhrase(slug: string | null | undefined): string | null {
  const label = categoryLabel(slug);
  return label === null ? null : label.charAt(0).toLowerCase() + label.slice(1);
}

export function attributeLabel(key: string): string {
  return ATTRIBUTE_LABELS[key] ?? humanizeSlug(key);
}

/** Engine article key "kuhp|362|1" → "KUHP 362 ayat 1". */
export function articleKeyLabel(key: string): string {
  const [law = '', article = '', paragraph = ''] = key.split('|');
  const lawLabel = law.length <= 6 ? law.toUpperCase() : humanizeSlug(law);
  return [lawLabel, article, paragraph === '' ? '' : `ayat ${paragraph}`]
    .filter((part) => part !== '')
    .join(' ');
}
