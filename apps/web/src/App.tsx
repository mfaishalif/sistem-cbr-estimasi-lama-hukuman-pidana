import { useEffect, useState } from 'react';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { HowItWorks } from '@/components/layout/HowItWorks';
import { TooltipProvider } from '@/components/ui/tooltip';
import { IndexStatusProvider } from '@/hooks/useIndexStatus';
import { copy } from '@/lib/copy';
import { ESTIMATE_HREF, HOME_HREF, isEmptyHash, isLegacyHash, parseHash, type Route } from '@/lib/route';
import { cn } from '@/lib/utils';
import { CasesPage } from '@/pages/cases/CasesPage';
import { EstimatePage } from '@/pages/estimate/EstimatePage';
import { LandingPage } from '@/pages/landing/LandingPage';

function currentRoute(): Route {
  const { hash } = window.location;
  if (isLegacyHash(hash)) {
    window.history.replaceState(null, '', ESTIMATE_HREF);
  } else if (isEmptyHash(hash)) {
    window.history.replaceState(null, '', HOME_HREF);
  }
  return parseHash(window.location.hash);
}

function pageTitle(route: Route): string {
  if (route.page === 'beranda') return copy.app.wordmark;
  const page = route.page === 'kasus' ? copy.app.navCases : copy.app.navEstimate;
  return `${page} · ${copy.app.wordmark}`;
}

function App() {
  const [route, setRoute] = useState<Route>(currentRoute);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const home = route.page === 'beranda';

  useEffect(() => {
    const onHashChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = pageTitle(route);
  }, [route]);

  const openHowItWorks = () => setHowItWorksOpen(true);

  return (
    <IndexStatusProvider>
      <TooltipProvider delayDuration={150}>
        <div className="flex min-h-screen flex-col bg-paper text-ink">
          <AppHeader route={route} onOpenHowItWorks={openHowItWorks} />
          {/* The landing sets its own vertical rhythm; the other pages keep theirs. */}
          <main className={cn('mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6', !home && 'pb-20 pt-10 lg:pt-14')}>
            {home ? <LandingPage onOpenHowItWorks={openHowItWorks} /> : null}
            {/* Estimasi stays mounted so its form and result survive a visit to another page. */}
            <div hidden={route.page !== 'estimasi'}>
              <EstimatePage />
            </div>
            {route.page === 'kasus' ? <CasesPage caseId={route.caseId} /> : null}
          </main>
          {home ? (
            <LandingFooter />
          ) : (
            <footer className="border-t border-rule">
              <p className="mx-auto max-w-6xl px-4 py-6 text-[13px] text-ink-subtle sm:px-6">{copy.app.footer}</p>
            </footer>
          )}
          <HowItWorks open={howItWorksOpen} onOpenChange={setHowItWorksOpen} />
        </div>
      </TooltipProvider>
    </IndexStatusProvider>
  );
}

export default App;
