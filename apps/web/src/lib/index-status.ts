export const INDEX_CHANGED_EVENT = 'cbr:index-changed';

/**
 * Case mutations do not rebuild the index themselves; they only advance the
 * case-base generation. Tell the shell to re-read index status so the badge
 * does not keep claiming "ready" for up to one polling interval.
 */
export function notifyIndexChanged(): void {
  window.dispatchEvent(new Event(INDEX_CHANGED_EVENT));
}
