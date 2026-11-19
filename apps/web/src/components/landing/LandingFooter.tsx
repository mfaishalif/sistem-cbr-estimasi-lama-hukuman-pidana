import { copy } from '@/lib/copy';

/** Replaces the one-line app footer on #beranda only. */
export function LandingFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-[13px] text-ink-subtle sm:px-6">
        <p>{copy.landing.footerProject}</p>
        <a
          href={copy.landing.datasetUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-sm underline-offset-4 hover:text-ink hover:underline"
        >
          {copy.landing.footerData}
        </a>
      </div>
    </footer>
  );
}
