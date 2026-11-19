/**
 * Number, percent, rupiah, and date formatting. Every number that reaches the
 * screen goes through `Intl` with the `id-ID` locale.
 */

const integerFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export function formatInteger(value: number): string {
  return integerFormat.format(value);
}

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

/** Fixed decimals, e.g. score parts "0,34". */
export function formatDecimal(value: number, digits = 2): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Fraction 0–1 → whole percent, e.g. 0,435 → "44%". */
export function formatPercent(fraction: number, digits = 0): string {
  const value = fraction * 100;
  return `${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}%`;
}

/** "Rp12.500.000" — no space, no decimals. */
export function formatRupiah(value: number): string {
  return `Rp${formatInteger(Math.round(value))}`;
}

/** Keep only digits from a rupiah field; empty when nothing is typed. */
export function rupiahDigits(input: string): string {
  return input.replace(/\D+/g, '').replace(/^0+(?=\d)/, '');
}

/** Digits → "12.500.000" for display inside the input. */
export function formatRupiahInput(digits: string): string {
  const clean = rupiahDigits(digits);
  return clean === '' ? '' : formatInteger(Number(clean));
}

const dateFormat = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "19 Nov 2026". Invalid input is returned as "—". */
export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return dateFormat.format(date).replace(/\./g, '');
}

/** Parse a user-typed decimal ("1,5" or "1.5") into a number, or null. */
export function parseDecimalInput(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') {
    return null;
  }
  if (!/^\d+([.,]\d+)?$/.test(trimmed)) {
    return Number.NaN;
  }
  return Number(trimmed.replace(',', '.'));
}

export function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter((word) => word !== '');
  return words.length;
}
