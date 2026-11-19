import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EstimateResult } from '@/lib/api';
import { copy } from '@/lib/copy';
import { caseHref } from '@/lib/route';
import { withholdingCopy } from '@/lib/withholding';
import { CalculationDetails } from './CalculationDetails';
import { SimilarRulings } from './SimilarRulings';

interface WithheldStateProps {
  result: EstimateResult;
  narration: string;
  onRetry: () => void;
  onSearchAllCategories: () => void;
  onEditNarration: () => void;
}

export function WithheldState({ result, narration, onRetry, onSearchAllCategories, onEditNarration }: WithheldStateProps) {
  const explanation = withholdingCopy(result);
  const [activeRank, setActiveRank] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const act = () => {
    if (explanation?.action === 'search-all-categories') onSearchAllCategories();
    else if (explanation?.action === 'edit-narration') onEditNarration();
    else if (explanation?.action === 'retry') onRetry();
    else if (explanation?.action === 'open-cases') window.location.hash = caseHref(null);
  };

  return (
    <div className="space-y-12">
      <div className="border-l-4 border-caution pl-5">
        <h2 className="flex items-center gap-2 font-heading text-2xl font-semibold text-caution">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          {copy.result.withheldTitle}
        </h2>
        <p className="mt-2 max-w-prose text-[15px] text-ink">{explanation?.body}</p>
        {explanation?.actionLabel ? (
          <Button className="mt-5" onClick={act}>
            {explanation.actionLabel}
          </Button>
        ) : null}
      </div>

      {result.references.length > 0 ? (
        <SimilarRulings
          title={copy.result.similarFoundTitle}
          references={result.references}
          narration={narration}
          activeRank={activeRank}
          onActiveRankChange={setActiveRank}
          showAll={showAll}
          onShowAllChange={setShowAll}
        />
      ) : null}

      <CalculationDetails result={result} />
    </div>
  );
}
