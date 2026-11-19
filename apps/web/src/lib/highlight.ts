/**
 * Shared-word highlighting for similar rulings.
 *
 * VISUAL APPROXIMATION ONLY. Words are normalized the same way the engine
 * normalizes narratives (NFKD, strip diacritics, lowercase, every
 * non-letter/non-digit run becomes a space, tokens ≥ 2 characters), so a word
 * marked here is a word the engine could also match. It does not reproduce the
 * TF-IDF weights: a highlighted word may carry almost no weight in the score.
 * A short display-only list of function words is skipped so the excerpt does
 * not light up on "yang" or "dan"; the engine itself has no stopwords.
 */

const MIN_TOKEN_LENGTH = 2;

const DISPLAY_STOPWORDS = new Set([
  'ada', 'adalah', 'agar', 'akan', 'atas', 'atau', 'bahwa', 'bagi', 'belum', 'dalam', 'dan',
  'dari', 'dengan', 'di', 'hal', 'ia', 'ini', 'itu', 'jika', 'juga', 'kan', 'ke', 'kepada',
  'lalu', 'lain', 'maka', 'masih', 'namun', 'nya', 'oleh', 'pada', 'para', 'saat', 'sebagai',
  'secara', 'sedang', 'sehingga', 'sudah', 'telah', 'tersebut', 'untuk', 'yaitu', 'yang',
]);

export function normalizeWord(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function tokenize(text: string): string[] {
  const normalized = normalizeWord(text);
  if (normalized === '') {
    return [];
  }
  return normalized.split(' ').filter((token) => token.length >= MIN_TOKEN_LENGTH);
}

function isHighlightable(token: string): boolean {
  return !DISPLAY_STOPWORDS.has(token) && !/^\d+$/.test(token);
}

/** Distinct tokens of the query that are worth highlighting. */
export function highlightTerms(query: string): Set<string> {
  return new Set(tokenize(query).filter(isHighlightable));
}

export interface Segment {
  text: string;
  match: boolean;
}

interface Word {
  start: number;
  end: number;
  match: boolean;
  token: string;
}

function words(text: string, terms: ReadonlySet<string>): Word[] {
  const result: Word[] = [];
  for (const found of text.matchAll(/[\p{L}\p{M}\p{N}]+/gu)) {
    const start = found.index;
    const tokens = tokenize(found[0]);
    const token = tokens.find((candidate) => terms.has(candidate)) ?? tokens[0] ?? '';
    result.push({ start, end: start + found[0].length, match: terms.has(token), token });
  }
  return result;
}

function toSegments(text: string, from: number, to: number, list: Word[]): Segment[] {
  const segments: Segment[] = [];
  let cursor = from;
  const push = (value: string, match: boolean) => {
    if (value === '') return;
    const last = segments.at(-1);
    if (last !== undefined && last.match === match) {
      last.text += value;
    } else {
      segments.push({ text: value, match });
    }
  };
  for (const word of list) {
    if (word.end <= from || word.start >= to) continue;
    if (!word.match) continue;
    push(text.slice(cursor, word.start), false);
    push(text.slice(word.start, word.end), true);
    cursor = word.end;
  }
  push(text.slice(cursor, to), false);
  return segments;
}

export interface Excerpt {
  segments: Segment[];
  clippedStart: boolean;
  clippedEnd: boolean;
}

/**
 * About `length` characters around the densest cluster of shared words, cut on
 * word boundaries. Without any shared word, the opening of the text is used.
 */
export function excerpt(text: string, terms: ReadonlySet<string>, length = 220): Excerpt {
  const clean = text.replace(/\s+/g, ' ').trim();
  const list = words(clean, terms);
  if (clean.length <= length) {
    return { segments: toSegments(clean, 0, clean.length, list), clippedStart: false, clippedEnd: false };
  }

  const matches = list.filter((word) => word.match);
  let bestStart = 0;
  let bestCount = -1;
  for (const anchor of matches) {
    const windowStart = anchor.start;
    const seen = new Set<string>();
    for (const word of matches) {
      if (word.start >= windowStart && word.end <= windowStart + length) seen.add(word.token);
    }
    if (seen.size > bestCount) {
      bestCount = seen.size;
      bestStart = windowStart;
    }
  }

  // Lead in a little before the first match so it does not start the excerpt cold.
  let from = matches.length === 0 ? 0 : Math.max(0, bestStart - Math.round(length * 0.2));
  let to = Math.min(clean.length, from + length);
  if (to === clean.length) from = Math.max(0, to - length);

  const startWord = list.find((word) => word.end > from);
  if (from > 0 && startWord !== undefined && startWord.start < from) from = startWord.end;
  const endWord = [...list].reverse().find((word) => word.start < to);
  if (to < clean.length && endWord !== undefined && endWord.end > to) to = endWord.start;

  from = skipLeading(clean, from);
  to = Math.max(from, trimTrailing(clean, to));
  return {
    segments: toSegments(clean, from, to, list),
    clippedStart: from > 0,
    clippedEnd: to < clean.length,
  };
}

function skipLeading(text: string, index: number): number {
  let position = index;
  while (position < text.length && /[\s,.;:]/.test(text.charAt(position))) position += 1;
  return position;
}

function trimTrailing(text: string, index: number): number {
  let position = index;
  while (position > 0 && /[\s,;:]/.test(text.charAt(position - 1))) position -= 1;
  return position;
}

/** Shared words ordered by how often they appear in the ruling, then alphabetically. */
export function sharedTerms(query: string, ruling: string, limit = 8): string[] {
  const terms = highlightTerms(query);
  const counts = new Map<string, number>();
  for (const token of tokenize(ruling)) {
    if (terms.has(token)) counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'id'))
    .slice(0, limit)
    .map(([token]) => token);
}
