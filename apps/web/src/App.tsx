import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { HowItWorks } from '@/components/layout/HowItWorks';
import { TooltipProvider } from '@/components/ui/tooltip';
import { IndexStatusProvider } from '@/hooks/useIndexStatus';
import { copy } from '@/lib/copy';
import { ESTIMATE_HREF, isLegacyHash, parseHash, type Route } from '@/lib/route';
import { CasesPage } from '@/pages/cases/CasesPage';
import { EstimatePage } from '@/pages/estimate/EstimatePage';

function currentRoute(): Route {
  if (isLegacyHash(window.location.hash)) {
    window.history.replaceState(null, '', ESTIMATE_HREF);
  }
  return parseHash(window.location.hash);
}

function App() {
  const [route, setRoute] = useState<Route>(currentRoute);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  useEffect(() => {
    const onHashChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title =
      route.page === 'kasus' ? `${copy.app.navCases} · ${copy.app.wordmark}` : `${copy.app.navEstimate} · ${copy.app.wordmark}`;
  }, [route.page]);

  return (
    <IndexStatusProvider>
      <TooltipProvider delayDuration={150}>
        <div className="flex min-h-screen flex-col bg-paper text-ink">
          <AppHeader route={route} onOpenHowItWorks={() => setHowItWorksOpen(true)} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-10 sm:px-6 lg:pt-14">
            {/* Estimasi stays mounted so its form and result survive a visit to Basis kasus. */}
            <div hidden={route.page !== 'estimasi'}>
              <EstimatePage />
            </div>
            {route.page === 'kasus' ? <CasesPage caseId={route.caseId} /> : null}
          </main>
          <footer className="border-t border-rule">
            <p className="mx-auto max-w-6xl px-4 py-6 text-[13px] text-ink-subtle sm:px-6">{copy.app.footer}</p>
          </footer>
          <HowItWorks open={howItWorksOpen} onOpenChange={setHowItWorksOpen} />
        </div>
      </TooltipProvider>
    </IndexStatusProvider>
  );
}

export default App;
