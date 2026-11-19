/**
 * Hash routes:
 * - `#beranda` → landing; an empty hash (`/`, `#`, `#/`) and unknown hashes
 *   also resolve here, and App rewrites an empty hash to `#beranda`;
 * - `#estimasi` → Estimasi (the old `#ringkasan` page resolves here too);
 * - `#kasus` → Basis kasus; `#kasus/<id>` opens that perkara.
 */
export type Route = { page: 'beranda' } | { page: 'estimasi' } | { page: 'kasus'; caseId: string | null };

export function parseHash(hash: string): Route {
  const value = hash.replace(/^#\/?/, '');
  if (value === 'kasus' || value.startsWith('kasus/')) {
    const id = value.slice('kasus/'.length);
    return { page: 'kasus', caseId: value === 'kasus' || id === '' ? null : decodeURIComponent(id) };
  }
  if (value === 'estimasi' || value === 'ringkasan') {
    return { page: 'estimasi' };
  }
  return { page: 'beranda' };
}

export function caseHref(id: string | null): string {
  return id === null ? '#kasus' : `#kasus/${encodeURIComponent(id)}`;
}

export const HOME_HREF = '#beranda';
export const ESTIMATE_HREF = '#estimasi';

/** True for hashes that App rewrites to a canonical one. */
export function isLegacyHash(hash: string): boolean {
  return hash === '#ringkasan';
}

/** `/`, `#` and `#/` carry no route; App rewrites them to `#beranda`. */
export function isEmptyHash(hash: string): boolean {
  return hash === '' || hash === '#' || hash === '#/';
}
