import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy';
import { ESTIMATE_HREF, caseHref } from '@/lib/route';
import { HeroIllustration } from './HeroIllustration';

export function Hero() {
  return (
    <section aria-labelledby="landing-title" className="grid items-center gap-12 py-16 lg:grid-cols-12 lg:gap-14 lg:py-24">
      <div className="space-y-6 lg:col-span-6">
        <p className="text-sm font-medium text-accent">{copy.landing.eyebrow}</p>
        <h1
          id="landing-title"
          // Sizes measured to keep Poppins on two lines: 360px fits 25px, 400px 28px,
          // the single column from 640px 44px, the half column at 1024px 34px, at 1280px 40px.
          className="text-balance font-heading text-[24px] font-semibold leading-[1.15] text-ink min-[400px]:text-[28px] sm:text-[40px] lg:text-[34px] xl:text-[40px]"
        >
          {copy.landing.title}
        </h1>
        <p className="max-w-xl text-[17px] text-ink-muted">{copy.landing.intro}</p>
        <div className="flex flex-wrap items-center gap-x-7 gap-y-3 pt-2">
          <Button asChild variant="primary">
            <a href={ESTIMATE_HREF}>{copy.landing.start}</a>
          </Button>
          <a
            href={caseHref(null)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-[15px] font-medium text-ink underline-offset-4 hover:text-accent hover:underline"
          >
            {copy.landing.explore}
            <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
      </div>
      <div className="lg:col-span-6">
        <HeroIllustration />
      </div>
    </section>
  );
}
