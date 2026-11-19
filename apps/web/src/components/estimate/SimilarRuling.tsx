import { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import type { ReferenceDetail } from '@/lib/api';
import { copy } from '@/lib/copy';
import { formatSentence } from '@/lib/duration';
import { formatPercent } from '@/lib/format';
import { excerpt } from '@/lib/highlight';
import { cn } from '@/lib/utils';
import { categoryLabel } from '@/lib/vocabulary';
import { RankBadge } from './RankBadge';
import { SimilarityReasons } from './SimilarityReasons';

interface SimilarRulingProps {
  id: string;
  reference: ReferenceDetail;
  narration: string;
  terms: ReadonlySet<string>;
  active: boolean;
  onActiveChange: (active: boolean) => void;
}

function articleText(reference: ReferenceDetail): string | null {
  const articles = reference.facts.articles ?? [];
  if (articles.length === 0) return null;
  return articles
    .map((article) => `${article.law} ${article.article}${article.paragraph ? ` ayat ${article.paragraph}` : ''}`)
    .join(', ');
}

/** No border or box: hierarchy comes from spacing; the list adds a hairline between items. */
export function SimilarRuling({ id, reference, narration, terms, active, onActiveChange }: SimilarRulingProps) {
  const [open, setOpen] = useState(false);
  const snippet = excerpt(reference.facts.narration, terms);
  const category = categoryLabel(reference.facts.category);
  const meta = [articleText(reference), reference.identity.court, reference.identity.caseNumber].filter(
    (part): part is string => part !== null && part !== '',
  );

  return (
    <li
      onMouseEnter={() => onActiveChange(true)}
      onMouseLeave={() => onActiveChange(false)}
      onFocus={() => onActiveChange(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onActiveChange(false);
      }}
      className="py-6 first:pt-0 last:pb-0"
    >
      <article
        id={id}
        tabIndex={-1}
        aria-labelledby={`${id}-title`}
        className={cn('-mx-3 scroll-mt-24 rounded-md px-3 py-1 transition-colors', active && 'bg-accent-soft/60')}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <RankBadge rank={reference.rank} className="self-center" />
          <h4 id={`${id}-title`} className="font-serif text-xl font-semibold text-ink">
            <span className="sr-only">Putusan #{reference.rank}, hukuman </span>
            {formatSentence(reference.actualSentenceDays)}
          </h4>
          {category === null ? null : <span className="text-sm text-ink-subtle">{category}</span>}
        </div>

        <div className="mt-3 flex items-center gap-3 text-[13px] text-ink-subtle">
          <span>{copy.result.similarityLabel}</span>
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
            <span className="block h-full rounded-full bg-ink" style={{ width: `${Math.round(reference.score * 100)}%` }} />
          </span>
          <span className="tabular font-medium text-ink">{formatPercent(reference.score)}</span>
        </div>

        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
          {snippet.clippedStart ? '… ' : ''}
          {snippet.segments.map((segment, index) =>
            segment.match ? <mark key={index}>{segment.text}</mark> : <span key={index}>{segment.text}</span>,
          )}
          {snippet.clippedEnd ? ' …' : ''}
        </p>

        {meta.length === 0 ? null : <p className="tabular mt-2 text-[13px] text-ink-subtle">{meta.join(' · ')}</p>}

        <Collapsible.Root open={open} onOpenChange={setOpen} className="mt-2">
          <Collapsible.Trigger className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover sm:min-h-9">
            {open ? copy.result.hideReasons : copy.result.showReasons}
            <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
          </Collapsible.Trigger>
          <Collapsible.Content className="pt-3">
            <SimilarityReasons reference={reference} narration={narration} />
          </Collapsible.Content>
        </Collapsible.Root>
      </article>
    </li>
  );
}
