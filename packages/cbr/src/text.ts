/**
 * Narrative normalization and tokenization.
 *
 * The same functions are used when fitting the TF-IDF vocabulary and when
 * transforming a query. Input is expected to contain pre-verdict facts only;
 * stripping the defendant/case identity happens during import, not here.
 */

export interface TokenizeOptions {
  minTokenLength: number;
  stopwords: readonly string[];
}

/**
 * Lowercase, remove diacritics, replace every non-letter/non-digit run with a
 * space, and collapse whitespace. Numerals are preserved because amounts and
 * counts can be relevant facts.
 */
export function normalizeNarrative(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Deterministic token sequence. The document and query paths share this
 * function so a term that cannot be produced here can never match.
 */
export function tokenizeNarrative(text: string, options: TokenizeOptions): string[] {
  const normalized = normalizeNarrative(text);
  if (normalized === '') {
    return [];
  }

  const stopwords = new Set(
    options.stopwords.map((word) => normalizeNarrative(word)).filter((word) => word !== ''),
  );

  return normalized
    .split(' ')
    .filter((token) => token.length >= options.minTokenLength && !stopwords.has(token));
}

export interface TermFrequency {
  /** Sparse counts keyed by token, in first-occurrence order. */
  counts: Map<string, number>;
  tokenCount: number;
}

export function countTerms(tokens: readonly string[]): TermFrequency {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return { counts, tokenCount: tokens.length };
}
