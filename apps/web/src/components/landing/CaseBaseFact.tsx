import { ArrowRight } from 'lucide-react';
import { useIndexStatus } from '@/hooks/useIndexStatus';
import { copy } from '@/lib/copy';
import { caseBaseFact } from '@/lib/landing';
import { caseHref } from '@/lib/route';

/** One sentence with the real case count; no other metric, no technical errors. */
export function CaseBaseFact() {
  const { index, error } = useIndexStatus();
  const fact = caseBaseFact(index, error);

  return (
    <section aria-labelledby="landing-casebase">
      <h2 id="landing-casebase" className="sr-only">
        {copy.landing.caseBaseTitle}
      </h2>
      <p className="max-w-4xl text-balance font-heading text-[28px] leading-snug text-ink sm:text-[32px]" aria-busy={fact.state === 'loading'}>
        {fact.state === 'unavailable' ? (
          copy.landing.caseBaseWithoutCount
        ) : (
          <>
            {copy.landing.caseBaseBefore}{' '}
            {fact.state === 'ready' ? (
              <strong className="tabular font-semibold">{fact.count}</strong>
            ) : (
              // Static placeholder the width of the number; no looping animation.
              <span className="inline-block h-[0.85em] w-[4.5ch] rounded-sm bg-surface-sunken align-[-0.08em]" aria-hidden />
            )}{' '}
            {copy.landing.caseBaseAfter}
          </>
        )}
      </p>
      <a
        href={caseHref(null)}
        className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-sm text-[15px] font-medium text-accent underline-offset-4 hover:text-accent-hover hover:underline"
      >
        {copy.landing.caseBaseLink}
        <ArrowRight className="size-4" aria-hidden />
      </a>
    </section>
  );
}
