import type { IndexStatus } from './api';
import { formatInteger } from './format';

/**
 * What the landing's "Basis kasus" sentence shows. The count only appears when
 * the index is ready; any error or unfinished index hides it, and the landing
 * never shows a technical message.
 */
export type CaseBaseFact = { state: 'loading' } | { state: 'ready'; count: string } | { state: 'unavailable' };

export function caseBaseFact(index: IndexStatus | null, error: string | null): CaseBaseFact {
  if (index === null) {
    return error === null ? { state: 'loading' } : { state: 'unavailable' };
  }
  if (index.status === 'ready' && index.caseCount > 0) {
    return { state: 'ready', count: formatInteger(index.caseCount) };
  }
  return { state: 'unavailable' };
}
