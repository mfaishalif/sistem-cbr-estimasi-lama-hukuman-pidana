import { formatInteger } from './format';

/**
 * Sentence durations are stored in days. The UI follows the project convention
 * 1 bulan = 30 hari and 1 tahun = 360 hari, the same convention the importer
 * uses to turn "1 tahun 6 bulan" into days.
 */
export const DAYS_PER_MONTH = 30;
export const DAYS_PER_YEAR = 360;

export type DurationUnit = 'tahun' | 'bulan' | 'hari';

export const DURATION_UNITS: Array<{ value: DurationUnit; label: string }> = [
  { value: 'tahun', label: 'Tahun' },
  { value: 'bulan', label: 'Bulan' },
  { value: 'hari', label: 'Hari' },
];

export function unitToDays(unit: DurationUnit): number {
  if (unit === 'tahun') return DAYS_PER_YEAR;
  if (unit === 'bulan') return DAYS_PER_MONTH;
  return 1;
}

/** Amount in a unit → whole days (half-up). */
export function toDays(amount: number, unit: DurationUnit): number {
  return Math.round(amount * unitToDays(unit));
}

export function formatDayCount(days: number): string {
  return `${formatInteger(days)} hari`;
}

function joinParts(years: number, months: number, days: number): string {
  const parts: string[] = [];
  if (years > 0) parts.push(`${formatInteger(years)} tahun`);
  if (months > 0) parts.push(`${formatInteger(months)} bulan`);
  if (days > 0) parts.push(`${formatInteger(days)} hari`);
  return parts.join(' ');
}

/** Exact: 336 → "11 bulan 6 hari", 365 → "1 tahun 5 hari", 0 → "0 hari". */
export function formatSentence(days: number): string {
  const total = Math.max(0, Math.round(days));
  if (total === 0) {
    return '0 hari';
  }
  const years = Math.floor(total / DAYS_PER_YEAR);
  const rest = total % DAYS_PER_YEAR;
  const months = Math.floor(rest / DAYS_PER_MONTH);
  return joinParts(years, months, rest % DAYS_PER_MONTH);
}

/**
 * Rounded to whole months for headlines: 336 → "± 11 bulan". Below one month
 * the day count is kept ("± 29 hari") because rounding to 0 or 1 month would
 * hide the actual value.
 */
export function formatSentenceApprox(days: number): string {
  const total = Math.max(0, Math.round(days));
  if (total === 0) {
    return '0 hari';
  }
  if (total < DAYS_PER_MONTH) {
    return `± ${formatInteger(total)} hari`;
  }
  const months = Math.round(total / DAYS_PER_MONTH);
  return `± ${joinParts(Math.floor(months / 12), months % 12, 0)}`;
}

/** Compact axis label for a month value: 6 → "6 bln", 12 → "1 thn", 18 → "1 thn 6 bln". */
export function formatMonthsTick(months: number): string {
  const whole = Math.round(months);
  if (whole === 0) return '0';
  const years = Math.floor(whole / 12);
  const rest = whole % 12;
  if (years === 0) return `${formatInteger(rest)} bln`;
  if (rest === 0) return `${formatInteger(years)} thn`;
  return `${formatInteger(years)} thn ${formatInteger(rest)} bln`;
}

/** Prefill for an amount + unit input: 720 → 2 tahun, 300 → 10 bulan, 45 → 45 hari. */
export function bestUnit(days: number): { amount: string; unit: DurationUnit } {
  if (days > 0 && days % DAYS_PER_YEAR === 0) return { amount: String(days / DAYS_PER_YEAR), unit: 'tahun' };
  if (days > 0 && days % DAYS_PER_MONTH === 0) return { amount: String(days / DAYS_PER_MONTH), unit: 'bulan' };
  return { amount: String(days), unit: 'hari' };
}
