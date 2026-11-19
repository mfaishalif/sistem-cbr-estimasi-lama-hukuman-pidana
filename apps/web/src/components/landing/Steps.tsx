import { copy } from '@/lib/copy';
import { formatInteger } from '@/lib/format';

/** Three numbered steps; whitespace separates them, no boxes or icons. */
export function Steps() {
  return (
    <section aria-labelledby="landing-steps">
      <h2 id="landing-steps" className="font-heading text-[28px] font-semibold text-ink">
        {copy.landing.stepsTitle}
      </h2>
      <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-12">
        {copy.landing.steps.map((step, index) => (
          <li key={step.title}>
            <span className="tabular block font-heading text-5xl font-semibold leading-none text-accent" aria-hidden>
              {formatInteger(index + 1)}
            </span>
            <h3 className="mt-4 text-[17px] font-semibold text-ink">{step.title}</h3>
            <p className="mt-2 max-w-sm text-[15px] text-ink-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
