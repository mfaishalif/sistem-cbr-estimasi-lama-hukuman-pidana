import { useCallback, useRef, useState } from 'react';
import { api, type CaseFacts, type EstimateResult } from '@/lib/api';

export type EstimateState =
  | { phase: 'idle' }
  | { phase: 'loading'; facts: CaseFacts }
  | { phase: 'error'; facts: CaseFacts; message: string }
  | { phase: 'done'; facts: CaseFacts; result: EstimateResult; runId: number };

/**
 * Runs `POST /api/estimates` and remembers the exact facts that were sent, so
 * staleness can be detected and Retain stores identical facts. A newer run
 * always wins over a slower older one.
 */
export function useEstimate(onSettled?: () => void) {
  const [state, setState] = useState<EstimateState>({ phase: 'idle' });
  const latest = useRef(0);

  const run = useCallback(
    async (facts: CaseFacts) => {
      latest.current += 1;
      const runId = latest.current;
      setState({ phase: 'loading', facts });
      try {
        const result = await api.estimate(facts);
        if (runId === latest.current) setState({ phase: 'done', facts, result, runId });
      } catch (error) {
        if (runId === latest.current) {
          const message =
            error instanceof Error && error.message !== ''
              ? error.message
              : 'Server tidak menjawab. Pastikan aplikasi berjalan, lalu coba lagi.';
          setState({ phase: 'error', facts, message });
        }
      } finally {
        if (runId === latest.current) onSettled?.();
      }
    },
    [onSettled],
  );

  return { state, run };
}

/** Stable comparison of two fact payloads (key order is fixed by buildFacts). */
export function sameFacts(a: CaseFacts, b: CaseFacts): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
