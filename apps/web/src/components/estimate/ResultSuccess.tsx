import { useCallback, useState } from 'react';
import type { CaseFacts, EstimateResult } from '@/lib/api';
import { copy } from '@/lib/copy';
import { formatSentenceApprox } from '@/lib/duration';
import { resultMeta, weightingSentence } from '@/lib/estimate';
import { ActualRuling } from './ActualRuling';
import { CalculationDetails } from './CalculationDetails';
import { SentenceRange } from './SentenceRange';
import { SimilarRulings, VISIBLE_RULINGS, rulingElementId } from './SimilarRulings';

interface ResultSuccessProps {
  result: EstimateResult;
  facts: CaseFacts;
  stale: boolean;
}

/** Order: number → range chart → similar rulings → calculation → actual ruling. */
export function ResultSuccess({ result, facts, stale }: ResultSuccessProps) {
  const [activeRank, setActiveRank] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [actualDays, setActualDays] = useState<number | null>(null);
  const days = result.estimate.days ?? 0;

  const selectRuling = (rank: number) => {
    if (rank > VISIBLE_RULINGS) setShowAll(true);
    requestAnimationFrame(() => {
      const element = document.getElementById(rulingElementId(rank));
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.focus({ preventScroll: true });
    });
  };

  const onActualChange = useCallback((value: number | null) => setActualDays(value), []);

  return (
    <div className="space-y-12">
      <div>
        <p className="text-sm font-medium text-ink-subtle">{copy.result.label}</p>
        <p className="mt-1 font-heading text-[52px] font-semibold leading-none text-ink sm:text-[64px]">
          {formatSentenceApprox(days)}
        </p>
        <p className="tabular mt-4 text-[15px] text-ink-muted">{resultMeta(result)}</p>
        <p className="mt-1 text-[13px] text-ink-subtle">{copy.result.disclaimer}</p>
      </div>

      <SentenceRange
        references={result.references}
        estimateDays={days}
        actualDays={actualDays}
        activeRank={activeRank}
        onActiveRankChange={setActiveRank}
        onSelect={selectRuling}
        explanation={weightingSentence(result)}
      />

      <SimilarRulings
        title={copy.result.similarTitle}
        references={result.references}
        narration={facts.narration}
        activeRank={activeRank}
        onActiveRankChange={setActiveRank}
        showAll={showAll}
        onShowAllChange={setShowAll}
      />

      <CalculationDetails result={result} />

      <ActualRuling
        estimateDays={result.estimate.days}
        facts={facts}
        stale={stale}
        onActualChange={onActualChange}
      />
    </div>
  );
}
