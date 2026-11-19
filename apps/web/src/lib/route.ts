/**
 * Hash routes: `#/`, `#estimasi` (default) → Estimasi; `#kasus` → Basis kasus;
 * `#kasus/<id>` → Basis kasus with that perkara open. The old `#ringkasan`
 * page no longer exists and resolves to Estimasi.
 */
export type Route = { page: 'estimasi' } | { page: 'kasus'; caseId: string | null };

export function parseHash(hash: string): Route {
  const value = hash.replace(/^#\/?/, '');
  if (value === 'kasus' || value.startsWith('kasus/')) {
    const id = value.slice('kasus/'.length);
    return { page: 'kasus', caseId: value === 'kasus' || id === '' ? null : decodeURIComponent(id) };
  }
  return { page: 'estimasi' };
}

export function caseHref(id: string | null): string {
  return id === null ? '#kasus' : `#kasus/${encodeURIComponent(id)}`;
}

export const ESTIMATE_HREF = '#estimasi';

/** True for hashes that should be rewritten, e.g. `#ringkasan`. */
export function isLegacyHash(hash: string): boolean {
  return hash === '#ringkasan';
}
