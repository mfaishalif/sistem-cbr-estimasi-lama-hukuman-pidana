import { ArrowRight } from 'lucide-react';
import { copy } from '@/lib/copy';

/** Neutral reminder of what an estimate is not; opens the existing "Cara kerja" drawer. */
export function Limits({ onOpenHowItWorks }: { onOpenHowItWorks: () => void }) {
  return (
    <section aria-labelledby="landing-limits">
      <h2 id="landing-limits" className="font-heading text-[28px] font-semibold text-ink">
        {copy.landing.limitsTitle}
      </h2>
      <div className="mt-6 rounded-md bg-surface-sunken px-6 py-6 sm:px-8 sm:py-8">
        <ul className="max-w-3xl list-disc space-y-3 pl-5 text-[17px] text-ink marker:text-ink-subtle">
          {copy.landing.limits.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onOpenHowItWorks}
          className="mt-6 inline-flex min-h-11 items-center gap-1.5 rounded-sm text-[15px] font-medium text-accent underline-offset-4 hover:text-accent-hover hover:underline"
        >
          {copy.landing.howItWorksLink}
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
