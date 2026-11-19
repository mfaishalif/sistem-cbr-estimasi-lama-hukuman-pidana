import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type IndexStatus } from '@/lib/api';
import { INDEX_CHANGED_EVENT } from '@/lib/index-status';

interface IndexStatusValue {
  /** null until the first response; stays null when the API is unreachable. */
  index: IndexStatus | null;
  error: string | null;
  refresh: () => Promise<void>;
}

const IndexStatusContext = createContext<IndexStatusValue | null>(null);

const IDLE_INTERVAL_MS = 15_000;
const BUILDING_INTERVAL_MS = 1_500;

/** One poller for the whole app; the header and the estimate page share it. */
export function IndexStatusProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState<IndexStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await api.indexStatus();
      setIndex(response.index);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Status indeks tidak tersedia');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChanged = () => void refresh();
    window.addEventListener(INDEX_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(INDEX_CHANGED_EVENT, onChanged);
  }, [refresh]);

  const building = index?.status === 'building';
  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), building ? BUILDING_INTERVAL_MS : IDLE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [building, refresh]);

  const value = useMemo(() => ({ index, error, refresh }), [index, error, refresh]);
  return <IndexStatusContext.Provider value={value}>{children}</IndexStatusContext.Provider>;
}

export function useIndexStatus(): IndexStatusValue {
  const value = useContext(IndexStatusContext);
  if (value === null) throw new Error('useIndexStatus dipakai di luar IndexStatusProvider');
  return value;
}
