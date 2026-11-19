import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, type VocabularyResponse } from '@/lib/api';
import { INDEX_CHANGED_EVENT } from '@/lib/index-status';
import {
  CATEGORIES,
  categoryOptionsFromVocabulary,
  type CategoryOption,
} from '@/lib/vocabulary';
import { useIndexStatus } from './useIndexStatus';

interface VocabularyValue {
  /** null until the first response; the hardcoded categories remain the fallback. */
  vocabulary: VocabularyResponse | null;
  categories: CategoryOption[];
  education: VocabularyResponse['attributes']['education'];
  occupation: VocabularyResponse['attributes']['occupation'];
  uncategorizedCount: number;
  error: string | null;
  refresh: () => Promise<void>;
}

const VocabularyContext = createContext<VocabularyValue | null>(null);

const FALLBACK_CATEGORIES: CategoryOption[] = CATEGORIES.map((option) => ({
  ...option,
  caseCount: 0,
}));

/**
 * One vocabulary reader for the case list, both forms, and the editor. The
 * case-base generation advances on every mutation, so a save makes the
 * category counts and attribute suggestions refresh without a page reload.
 */
export function VocabularyProvider({ children }: { children: ReactNode }) {
  const [vocabulary, setVocabulary] = useState<VocabularyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { index } = useIndexStatus();

  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++requestId.current;
    try {
      const response = await api.vocabulary();
      if (current !== requestId.current) return;
      setVocabulary(response);
      setError(null);
    } catch (caught) {
      if (current !== requestId.current) return;
      setError(caught instanceof Error ? caught.message : 'Daftar kategori tidak tersedia');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChanged = () => void refresh();
    window.addEventListener(INDEX_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(INDEX_CHANGED_EVENT, onChanged);
  }, [refresh]);

  const generation =
    index?.status === 'ready'
      ? index.generation
      : index?.status === 'stale'
        ? index.currentGeneration
        : null;

  useEffect(() => {
    if (generation !== null) void refresh();
  }, [generation, refresh]);

  const value = useMemo<VocabularyValue>(() => {
    const categories =
      vocabulary === null
        ? FALLBACK_CATEGORIES
        : categoryOptionsFromVocabulary(vocabulary.categories);
    return {
      vocabulary,
      categories,
      education: vocabulary?.attributes.education ?? [],
      occupation: vocabulary?.attributes.occupation ?? [],
      uncategorizedCount: vocabulary?.uncategorizedCount ?? 0,
      error,
      refresh,
    };
  }, [vocabulary, error, refresh]);

  return <VocabularyContext.Provider value={value}>{children}</VocabularyContext.Provider>;
}

export function useVocabulary(): VocabularyValue {
  const value = useContext(VocabularyContext);
  if (value === null) throw new Error('useVocabulary dipakai di luar VocabularyProvider');
  return value;
}
