import type { CaseArticle, FactValue } from './api';
import { parseSetValue } from './case-form';
import { formatDate, formatInteger, formatRupiah } from './format';
import {
  ARRANGEMENTS,
  GENDERS,
  ROLES,
  VICTIM_HARM,
  WEAPON_OR_MODE,
  attributeLabel,
  labelFor,
} from './vocabulary';

/** Display order for "Detail perkara" in Basis kasus. */
export const ATTRIBUTE_ORDER = [
  'gender',
  'age_years',
  'education',
  'occupation',
  'prior_conviction',
  'role',
  'victim_harm',
  'weapon_or_mode',
  'victim_count',
  'loss_amount_idr',
];

function raw(value: FactValue): string {
  if (value.type === 'boolean') return value.value ? 'ya' : 'tidak';
  if (value.type === 'number') return formatInteger(value.value);
  return value.value;
}

export function formatFact(key: string, value: FactValue, all: Record<string, FactValue> = {}): string {
  switch (key) {
    case 'gender':
      return labelFor(GENDERS, raw(value));
    case 'role':
      return labelFor(ROLES, raw(value));
    case 'prior_conviction':
      return raw(value) === 'yes' ? 'Pernah dihukum' : raw(value) === 'no' ? 'Belum pernah dihukum' : raw(value);
    case 'victim_harm':
      return parseSetValue(value).map((item) => labelFor(VICTIM_HARM, item)).join(', ');
    case 'weapon_or_mode':
      return parseSetValue(value).map((item) => labelFor(WEAPON_OR_MODE, item)).join(', ');
    case 'loss_amount_idr':
      return value.type === 'number' ? formatRupiah(value.value) : raw(value);
    case 'victim_count':
      return value.type === 'number' ? `${formatInteger(value.value)} orang` : raw(value);
    case 'age_years': {
      const age = value.type === 'number' ? `${formatInteger(value.value)} tahun` : raw(value);
      const date = all.age_reference_date;
      return date === undefined ? age : `${age} (saat ditangkap ${formatDate(raw(date))})`;
    }
    default:
      return raw(value);
  }
}

/** Recorded attributes in display order; the reference date is folded into age. */
export function recordedFacts(attributes: Record<string, FactValue> | undefined): Array<{ key: string; label: string; value: string }> {
  const entries = attributes ?? {};
  const keys = [
    ...ATTRIBUTE_ORDER.filter((key) => key in entries),
    ...Object.keys(entries).filter((key) => !ATTRIBUTE_ORDER.includes(key) && key !== 'age_reference_date'),
  ];
  return keys.map((key) => ({ key, label: attributeLabel(key), value: formatFact(key, entries[key]!, entries) }));
}

export function formatArticle(article: CaseArticle): string {
  const base = `${article.law} ${article.article}${article.paragraph ? ` ayat ${article.paragraph}` : ''}`;
  const arrangement = article.arrangement === undefined || article.arrangement === 'primary' ? null : labelFor(ARRANGEMENTS, article.arrangement);
  return arrangement === null ? base : `${base} (${arrangement.toLowerCase()})`;
}
