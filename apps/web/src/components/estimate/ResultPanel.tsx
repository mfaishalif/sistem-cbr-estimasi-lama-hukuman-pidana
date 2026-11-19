import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EstimateState } from '@/hooks/useEstimate';
import type { IndexStatus } from '@/lib/api';
import { copy } from '@/lib/copy';
import { formatSentenceApprox } from '@/lib/duration';
import { EmptyState, ErrorState, IndexNotice, LoadingState } from './ResultStates';
import { ResultSuccess } from './ResultSuccess';
import { WithheldState } from './WithheldState';

interface ResultPanelProps {
  state: EstimateState;
  stale: boolean;
  index: IndexStatus | null;
  onRetry: () => void;
  onSearchAllCategories: () => void;
  onEditNarration: () => void;
}

function announcement(state: EstimateState): string {
  if (state.phase === 'loading') return copy.result.loading;
  if (state.phase === 'error') return `${copy.result.errorTitle}. ${state.message}`;
  if (state.phase === 'done') {
    const days = state.result.estimate.days;
    return state.result.status === 'estimated' && days !== null
      ? `${copy.result.label} ${formatSentenceApprox(days)}, dari ${state.result.references.length} putusan serupa.`
      : copy.result.withheldTitle;
  }
  return '';
}

/** The single bordered container on the page. */
export function ResultPanel({ state, stale, index, onRetry, onSearchAllCategories, onEditNarration }: ResultPanelProps) {
  return (
    <div className="rounded-md border border-rule bg-surface px-5 py-8 sm:px-8 sm:py-10">
      <p className="sr-only" aria-live="polite" aria-atomic>
        {announcement(state)}
      </p>

      {state.phase === 'done' && stale ? (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-md bg-caution-soft px-4 py-3">
          <p className="text-[15px] font-medium text-caution">{copy.result.stale}</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RotateCw aria-hidden />
            {copy.result.recalculate}
          </Button>
        </div>
      ) : null}

      {state.phase === 'idle' ? (
        <>
          <IndexNotice index={index} />
          <EmptyState />
        </>
      ) : null}
      {state.phase === 'loading' ? <LoadingState building={index?.status === 'building'} /> : null}
      {state.phase === 'error' ? <ErrorState message={state.message} onRetry={onRetry} /> : null}
      {state.phase === 'done' && state.result.status === 'withheld' ? (
        <WithheldState
          result={state.result}
          narration={state.facts.narration}
          onRetry={onRetry}
          onSearchAllCategories={onSearchAllCategories}
          onEditNarration={onEditNarration}
        />
      ) : null}
      {state.phase === 'done' && state.result.status === 'estimated' ? (
        <ResultSuccess key={state.runId} result={state.result} facts={state.facts} stale={stale} />
      ) : null}
    </div>
  );
}
