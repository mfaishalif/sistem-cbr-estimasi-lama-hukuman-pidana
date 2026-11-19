import { copy } from '@/lib/copy';
import { ESTIMATE_HREF, HOME_HREF, caseHref, type Route } from '@/lib/route';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  route: Route;
  onOpenHowItWorks: () => void;
}

export function AppHeader({ route, onOpenHowItWorks }: AppHeaderProps) {
  const items = [
    { href: ESTIMATE_HREF, label: copy.app.navEstimate, active: route.page === 'estimasi' },
    { href: caseHref(null), label: copy.app.navCases, active: route.page === 'kasus' },
  ];

  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-1 px-4 py-3 sm:px-6 lg:h-16 lg:py-0">
        <a href={HOME_HREF} className="rounded-sm font-heading text-lg font-semibold text-ink">
          {copy.app.wordmark}
        </a>
        <nav aria-label="Navigasi utama" className="order-3 flex w-full gap-6 sm:order-none sm:w-auto">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center border-b-2 text-[15px] transition-colors',
                item.active
                  ? 'border-accent font-medium text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink',
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={onOpenHowItWorks}
            className="min-h-11 text-[15px] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            {copy.app.howItWorks}
          </button>
        </div>
      </div>
    </header>
  );
}
