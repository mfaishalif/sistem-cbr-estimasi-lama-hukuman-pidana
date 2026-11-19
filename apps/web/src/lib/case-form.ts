import type { CaseArticle, CaseDraft, CaseFacts, CaseUnit, FactValue } from './api';
import { toDays, type DurationUnit } from './duration';
import { formatRupiah, parseDecimalInput, rupiahDigits } from './format';
import { GENDERS, PRIOR_CONVICTION, ROLES, VICTIM_HARM, WEAPON_OR_MODE, labelFor } from './vocabulary';

/**
 * Form state ↔ API mapping. "Unknown" is the empty value of each control and
 * is never sent: an attribute that is not known has no row at all, which the
 * engine treats differently from zero or "no".
 *
 * Wire types are kept exactly as before the redesign: gender, occupation,
 * education and role as `text`; prior_conviction as `enum`; victim_harm and
 * weapon_or_mode as `set` holding a JSON array string; counts, age and loss as
 * `number`.
 */

export type ArticleArrangement = 'primary' | 'alternative' | 'subsidiary';

export interface ArticleRowState {
  key: string;
  law: string;
  article: string;
  paragraph: string;
  arrangement: ArticleArrangement;
}

export interface CaseFormState {
  court: string;
  caseNumber: string;
  defendantName: string;
  narration: string;
  category: string;
  articles: ArticleRowState[];
  ageYears: string;
  ageReferenceDate: string;
  gender: string;
  occupation: string;
  education: string;
  role: string;
  victimCount: string;
  victimHarm: string[];
  /** Digits only; formatted with thousand separators by the input. */
  lossAmountIdr: string;
  weaponOrMode: string[];
  priorConviction: '' | 'yes' | 'no';
}

/** `field` matches the suffix of the input id so the error summary can link to it. */
export interface FieldError {
  field: string;
  message: string;
}

let rowCounter = 0;

export function newArticleRow(initial: Partial<ArticleRowState> = {}): ArticleRowState {
  rowCounter += 1;
  return {
    key: `article-${rowCounter}`,
    law: 'KUHP',
    article: '',
    paragraph: '',
    arrangement: 'primary',
    ...initial,
  };
}

export function emptyCaseForm(): CaseFormState {
  return {
    court: '',
    caseNumber: '',
    defendantName: '',
    narration: '',
    category: '',
    articles: [],
    ageYears: '',
    ageReferenceDate: '',
    gender: '',
    occupation: '',
    education: '',
    role: '',
    victimCount: '',
    victimHarm: [],
    lossAmountIdr: '',
    weaponOrMode: [],
    priorConviction: '',
  };
}

function stringValue(value: FactValue | undefined): string {
  if (value === undefined) return '';
  if (value.type === 'boolean') return value.value ? 'true' : 'false';
  if (value.type === 'number') return String(value.value);
  return value.value;
}

export function parseSetValue(value: FactValue | undefined): string[] {
  if (value === undefined || value.type !== 'set') return [];
  try {
    const parsed: unknown = JSON.parse(value.value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function caseFormFromUnit(unit: CaseUnit): CaseFormState {
  const attributes = unit.facts.attributes ?? {};
  const loss = attributes.loss_amount_idr;
  const prior = attributes.prior_conviction;
  return {
    court: unit.identity.court,
    caseNumber: unit.identity.caseNumber,
    defendantName: unit.identity.defendantName ?? '',
    narration: unit.facts.narration,
    category: unit.facts.category ?? '',
    articles: (unit.facts.articles ?? []).map((article) =>
      newArticleRow({
        law: article.law,
        article: article.article,
        paragraph: article.paragraph ?? '',
        arrangement: article.arrangement ?? 'primary',
      }),
    ),
    ageYears: stringValue(attributes.age_years),
    ageReferenceDate: stringValue(attributes.age_reference_date).slice(0, 10),
    gender: stringValue(attributes.gender),
    occupation: stringValue(attributes.occupation),
    education: stringValue(attributes.education),
    role: stringValue(attributes.role),
    victimCount: stringValue(attributes.victim_count),
    victimHarm: parseSetValue(attributes.victim_harm),
    lossAmountIdr: loss?.type === 'number' ? String(Math.round(loss.value)) : '',
    weaponOrMode: parseSetValue(attributes.weapon_or_mode),
    priorConviction:
      prior?.type === 'enum' && (prior.value === 'yes' || prior.value === 'no') ? prior.value : '',
  };
}

function parseWholeNumber(value: string, field: string, message: string, errors: FieldError[]): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) {
    errors.push({ field, message });
    return null;
  }
  return parsed;
}

export function buildArticles(form: CaseFormState, errors: FieldError[]): CaseArticle[] {
  const articles: CaseArticle[] = [];
  form.articles.forEach((row, index) => {
    const law = row.law.trim();
    const article = row.article.trim();
    const paragraph = row.paragraph.trim();
    if (article === '' && paragraph === '') return;
    if (article === '') {
      errors.push({ field: `article-${index}-number`, message: `Isi nomor pasal pada baris ${index + 1}, misalnya 362.` });
      return;
    }
    if (law === '') {
      errors.push({ field: `article-${index}-law`, message: `Isi undang-undang pada baris ${index + 1}, misalnya KUHP.` });
      return;
    }
    articles.push({ law, article, paragraph: paragraph || null, arrangement: row.arrangement });
  });
  return articles;
}

export function buildAttributes(form: CaseFormState, errors: FieldError[]): Record<string, FactValue> {
  const attributes: Record<string, FactValue> = {};

  const age = parseWholeNumber(form.ageYears, 'age', 'Tulis umur sebagai angka bulat, misalnya 27.', errors);
  if (age !== null) {
    const date = form.ageReferenceDate.trim();
    if (date === '') {
      errors.push({ field: 'age-date', message: 'Isi tanggal penangkapan agar umur dapat dibandingkan.' });
    } else {
      attributes.age_years = { type: 'number', value: age, unit: 'tahun' };
      attributes.age_reference_date = { type: 'text', value: date };
    }
  }

  const texts: Array<[string, string]> = [
    ['gender', form.gender.trim()],
    ['occupation', form.occupation.trim().toLowerCase()],
    ['education', form.education.trim().toLowerCase()],
    ['role', form.role.trim()],
  ];
  for (const [key, value] of texts) {
    if (value !== '') attributes[key] = { type: 'text', value };
  }

  const victims = parseWholeNumber(form.victimCount, 'victim-count', 'Tulis jumlah korban sebagai angka bulat, misalnya 1.', errors);
  if (victims !== null) attributes.victim_count = { type: 'number', value: victims };

  const loss = rupiahDigits(form.lossAmountIdr);
  if (loss !== '') attributes.loss_amount_idr = { type: 'number', value: Number(loss), unit: 'IDR' };

  if (form.victimHarm.length > 0) {
    attributes.victim_harm = { type: 'set', value: JSON.stringify(form.victimHarm) };
  }
  if (form.weaponOrMode.length > 0) {
    attributes.weapon_or_mode = { type: 'set', value: JSON.stringify(form.weaponOrMode) };
  }
  if (form.priorConviction !== '') {
    attributes.prior_conviction = { type: 'enum', value: form.priorConviction };
  }
  return attributes;
}

export function buildFacts(form: CaseFormState, errors: FieldError[]): CaseFacts {
  return {
    narration: form.narration.trim(),
    category: form.category.trim() || null,
    articles: buildArticles(form, errors),
    attributes: buildAttributes(form, errors),
  };
}

export function validateNarration(form: CaseFormState, errors: FieldError[]): void {
  if (form.narration.trim() === '') {
    errors.push({ field: 'narration', message: 'Tulis kronologi perkara sebelum menghitung estimasi.' });
  }
}

export interface IdentityInput {
  court: string;
  caseNumber: string;
  defendantName: string;
}

export function validateIdentity(identity: IdentityInput, errors: FieldError[]): void {
  if (identity.court.trim() === '') {
    errors.push({ field: 'court', message: 'Isi nama pengadilan, misalnya PN Jakarta Selatan.' });
  }
  if (identity.caseNumber.trim() === '') {
    errors.push({ field: 'case-number', message: 'Isi nomor perkara, misalnya 12/Pid.B/2024/PN Jkt.Sel.' });
  }
}

/** Retain uses the exact facts that were estimated, plus identity and outcome. */
export function draftFromFacts(facts: CaseFacts, identity: IdentityInput, actualSentenceDays: number | null): CaseDraft {
  return {
    court: identity.court.trim(),
    caseNumber: identity.caseNumber.trim(),
    defendantName: identity.defendantName.trim() || null,
    narration: facts.narration,
    category: facts.category ?? null,
    articles: facts.articles ?? [],
    attributes: facts.attributes ?? {},
    actualSentenceDays,
  };
}

/**
 * Sentence typed as amount + unit ("1,5" tahun → 540 hari). Empty input is
 * `null` when `required` is false; otherwise an error.
 */
export function parseSentenceInput(
  amount: string,
  unit: DurationUnit,
  field: string,
  required: boolean,
  errors: FieldError[],
): number | null {
  const parsed = parseDecimalInput(amount);
  if (parsed === null) {
    if (required) errors.push({ field, message: 'Isi lama penjara dalam putusan, misalnya 10 bulan.' });
    return null;
  }
  const days = Number.isNaN(parsed) ? Number.NaN : toDays(parsed, unit);
  if (!Number.isFinite(days) || days <= 0) {
    errors.push({ field, message: 'Tulis lama penjara sebagai angka lebih dari nol, misalnya 10 atau 1,5.' });
    return null;
  }
  return days;
}

/** Chips for the collapsed "Tambah detail perkara" row. */
export function detailSummary(form: CaseFormState): string[] {
  const chips: string[] = [];
  for (const row of form.articles) {
    if (row.article.trim() !== '') {
      chips.push(`${row.law.trim()} ${row.article.trim()}${row.paragraph.trim() ? ` ayat ${row.paragraph.trim()}` : ''}`.trim());
    }
  }
  if (form.gender !== '') chips.push(labelFor(GENDERS, form.gender));
  if (form.ageYears.trim() !== '') chips.push(`${form.ageYears.trim()} tahun`);
  if (form.education.trim() !== '') chips.push(form.education.trim());
  if (form.occupation.trim() !== '') chips.push(form.occupation.trim());
  if (form.priorConviction !== '') {
    chips.push(form.priorConviction === 'yes' ? 'Pernah dihukum' : `${labelFor(PRIOR_CONVICTION, 'no')} dihukum`);
  }
  if (form.role !== '') chips.push(labelFor(ROLES, form.role));
  for (const value of form.victimHarm) chips.push(labelFor(VICTIM_HARM, value));
  for (const value of form.weaponOrMode) chips.push(labelFor(WEAPON_OR_MODE, value));
  if (form.victimCount.trim() !== '') chips.push(`${form.victimCount.trim()} korban`);
  const loss = rupiahDigits(form.lossAmountIdr);
  if (loss !== '') chips.push(`Kerugian ${formatRupiah(Number(loss))}`);
  return chips;
}
