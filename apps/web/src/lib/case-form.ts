import type {
  CaseArticle,
  CaseDraft,
  CaseFacts,
  CaseUnit,
  FactValue,
} from './api';

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
  victimHarm: string;
  lossAmountIdr: string;
  weaponOrMode: string;
  priorConviction: '' | 'yes' | 'no';
}

let rowCounter = 0;

export function newArticleRow(): ArticleRowState {
  rowCounter += 1;
  return {
    key: `article-${Date.now()}-${rowCounter}`,
    law: '',
    article: '',
    paragraph: '',
    arrangement: 'primary',
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
    victimHarm: '',
    lossAmountIdr: '',
    weaponOrMode: '',
    priorConviction: '',
  };
}

function stringValue(value: FactValue | undefined): string {
  if (value === undefined) {
    return '';
  }
  if (value.type === 'boolean') {
    return value.value ? 'true' : 'false';
  }
  if (value.type === 'number') {
    return String(value.value);
  }
  return value.value;
}

function setValue(value: FactValue | undefined): string {
  if (value === undefined || value.type !== 'set') {
    return '';
  }
  try {
    const parsed: unknown = JSON.parse(value.value);
    return Array.isArray(parsed) ? parsed.join(', ') : '';
  } catch {
    return '';
  }
}

export function caseFormFromUnit(unit: CaseUnit): CaseFormState {
  const attributes = unit.facts.attributes ?? {};
  return {
    court: unit.identity.court,
    caseNumber: unit.identity.caseNumber,
    defendantName: unit.identity.defendantName ?? '',
    narration: unit.facts.narration,
    category: unit.facts.category ?? '',
    articles: (unit.facts.articles ?? []).map((article) => {
      rowCounter += 1;
      return {
        key: `article-${Date.now()}-${rowCounter}`,
        law: article.law,
        article: article.article,
        paragraph: article.paragraph ?? '',
        arrangement: article.arrangement ?? 'primary',
      };
    }),
    ageYears: stringValue(attributes.age_years),
    ageReferenceDate: stringValue(attributes.age_reference_date).slice(0, 10),
    gender: stringValue(attributes.gender),
    occupation: stringValue(attributes.occupation),
    education: stringValue(attributes.education),
    role: stringValue(attributes.role),
    victimCount: stringValue(attributes.victim_count),
    victimHarm: setValue(attributes.victim_harm),
    lossAmountIdr: stringValue(attributes.loss_amount_idr),
    weaponOrMode: setValue(attributes.weapon_or_mode),
    priorConviction:
      attributes.prior_conviction?.type === 'enum' &&
      (attributes.prior_conviction.value === 'yes' ||
        attributes.prior_conviction.value === 'no')
        ? attributes.prior_conviction.value
        : '',
  };
}

function parseNumber(value: string, label: string, errors: string[]): number | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    errors.push(`${label} harus berupa angka.`);
    return null;
  }
  return parsed;
}

function splitSet(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

export function buildArticles(form: CaseFormState, errors: string[]): CaseArticle[] {
  const articles: CaseArticle[] = [];
  for (const [index, row] of form.articles.entries()) {
    const law = row.law.trim();
    const article = row.article.trim();
    if (law === '' && article === '') {
      continue;
    }
    if (law === '' || article === '') {
      errors.push(`Pasal baris ${index + 1}: undang-undang dan pasal harus diisi bersama.`);
      continue;
    }
    articles.push({
      law,
      article,
      paragraph: row.paragraph.trim() || null,
      arrangement: row.arrangement,
    });
  }
  return articles;
}

export function buildAttributes(form: CaseFormState, errors: string[]): Record<string, FactValue> {
  const attributes: Record<string, FactValue> = {};

  const age = parseNumber(form.ageYears, 'Umur', errors);
  if (age !== null) {
    attributes.age_years = { type: 'number', value: age, unit: 'tahun' };
  }
  if (form.ageReferenceDate.trim() !== '') {
    attributes.age_reference_date = { type: 'text', value: form.ageReferenceDate.trim() };
  }

  const textAttributes: Array<[string, string]> = [
    ['gender', form.gender],
    ['occupation', form.occupation],
    ['education', form.education],
    ['role', form.role],
  ];
  for (const [key, value] of textAttributes) {
    if (value.trim() !== '') {
      attributes[key] = { type: 'text', value: value.trim() };
    }
  }

  const victimCount = parseNumber(form.victimCount, 'Jumlah korban', errors);
  if (victimCount !== null) {
    attributes.victim_count = { type: 'number', value: victimCount };
  }

  const loss = parseNumber(form.lossAmountIdr, 'Kerugian', errors);
  if (loss !== null) {
    attributes.loss_amount_idr = { type: 'number', value: loss, unit: 'IDR' };
  }

  const harm = splitSet(form.victimHarm);
  if (harm.length > 0) {
    attributes.victim_harm = { type: 'set', value: JSON.stringify(harm) };
  }

  const mode = splitSet(form.weaponOrMode);
  if (mode.length > 0) {
    attributes.weapon_or_mode = { type: 'set', value: JSON.stringify(mode) };
  }

  if (form.priorConviction !== '') {
    attributes.prior_conviction = { type: 'enum', value: form.priorConviction };
  }

  return attributes;
}

export function buildFacts(form: CaseFormState, errors: string[]): CaseFacts {
  return {
    narration: form.narration.trim(),
    category: form.category.trim() || null,
    articles: buildArticles(form, errors),
    attributes: buildAttributes(form, errors),
  };
}

export function buildDraft(
  form: CaseFormState,
  actualSentenceDays: number | null,
  errors: string[],
): CaseDraft {
  return {
    court: form.court.trim(),
    caseNumber: form.caseNumber.trim(),
    defendantName: form.defendantName.trim() || null,
    ...buildFacts(form, errors),
    actualSentenceDays,
  };
}

export function validateFacts(form: CaseFormState, errors: string[]): void {
  if (form.narration.trim() === '') {
    errors.push('Narasi fakta perkara wajib diisi.');
  }
}

export function validateIdentity(form: CaseFormState, errors: string[]): void {
  if (form.court.trim() === '') {
    errors.push('Pengadilan wajib diisi untuk menyimpan kasus.');
  }
  if (form.caseNumber.trim() === '') {
    errors.push('Nomor perkara wajib diisi untuk menyimpan kasus.');
  }
}

/** CRUD may keep the outcome unknown; Retain still requires a positive value. */
export function parseOptionalOutcome(value: string, errors: string[]): number | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) {
    errors.push('Hasil aktual harus berupa bilangan bulat tidak negatif dalam hari.');
    return null;
  }
  return parsed;
}

export function parsePositiveOutcome(value: string, errors: string[]): number | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    errors.push('Hasil aktual (hari) wajib diisi.');
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    errors.push('Hasil aktual harus berupa bilangan bulat positif dalam hari.');
    return null;
  }
  return parsed;
}
