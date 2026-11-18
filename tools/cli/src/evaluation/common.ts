/** Small pure helpers shared by the evaluation modules. */

/** Treat only positive, finite outcomes as the positive term-imprisonment target. */
export function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Median of a non-empty list. Even counts average the two middle values. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  if (upper === undefined) {
    throw new Error('Median memerlukan minimal satu nilai.');
  }
  if (sorted.length % 2 === 1) {
    return upper;
  }
  return ((sorted[middle - 1] as number) + upper) / 2;
}

/** Trim a category and treat an empty value as absent. */
export function normalizeCategory(category: string | null | undefined): string | null {
  if (category === null || category === undefined) {
    return null;
  }
  const trimmed = category.trim();
  return trimmed === '' ? null : trimmed;
}

export function compareIds(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

/** Alphabetical order with the null group last. */
export function compareNullLast(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return compareIds(left, right);
}

export function assertUniqueUnitIds(ids: Iterable<string>, label: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (id.trim() === '') {
      throw new Error(`${label} wajib diisi.`);
    }
    if (seen.has(id)) {
      throw new Error(`${label} duplikat: ${id}`);
    }
    seen.add(id);
  }
}
