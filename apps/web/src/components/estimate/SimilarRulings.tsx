import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type { ReferenceDetail } from '@/lib/api';
import { copy } from '@/lib/copy';
import { formatInteger } from '@/lib/format';
import { highlightTerms } from '@/lib/highlight';
import { SimilarRuling } from './SimilarRuling';

export const VISIBLE_RULINGS = 3;

interface SimilarRulingsProps {
  title: string;
  references: ReferenceDetail[];
  narration: string;
  activeRank: number | null;
  onActiveRankChange: (rank: number | null) => void;
  showAll: boolean;
  onShowAllChange: (showAll: boolean) => void;
}

export function rulingElementId(rank: number): string {
  return `putusan-serupa-${rank}`;
}

export function SimilarRulings({ title, references, narration, activeRank, onActiveRankChange, showAll, onShowAllChange }: SimilarRulingsProps) {
  const terms = useMemo(() => highlightTerms(narration), [narration]);
  const sorted = [...references].sort((a, b) => a.rank - b.rank);
  const visible = showAll ? sorted : sorted.slice(0, VISIBLE_RULINGS);
  const hidden = sorted.length - visible.length;

  return (
    <section aria-labelledby="similar-rulings-title" className="space-y-6">
      <div className="space-y-1">
        <h3 id="similar-rulings-title" className="font-serif text-xl font-semibold text-ink">
          {title}
        </h3>
        <p className="text-[13px] text-ink-subtle">{copy.result.similarityNote}</p>
      </div>

      <ol className="divide-y divide-rule">
        {visible.map((reference) => (
          <SimilarRuling
            key={reference.caseUnitId}
            id={rulingElementId(reference.rank)}
            reference={reference}
            narration={narration}
            terms={terms}
            active={activeRank === reference.rank}
            onActiveChange={(active) => onActiveRankChange(active ? reference.rank : null)}
          />
        ))}
      </ol>

      {hidden > 0 ? (
        <Button variant="secondary" size="sm" onClick={() => onShowAllChange(true)}>
          Tampilkan {formatInteger(hidden)} putusan lainnya
        </Button>
      ) : null}
    </section>
  );
}
