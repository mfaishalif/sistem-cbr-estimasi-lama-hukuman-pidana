import { useEffect, useState } from 'react';
import { Database, LayoutDashboard, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { api, type IndexStatusResponse } from '@/lib/api';
import { indexStatusLabel } from '@/lib/display';
import { INDEX_CHANGED_EVENT } from '@/lib/index-status';
import { OverviewPage } from '@/pages/OverviewPage';
import { EstimatePage } from '@/pages/EstimatePage';
import { CasesPage } from '@/pages/CasesPage';

type PageId = 'ringkasan' | 'estimasi' | 'kasus';

const pages: Array<{ id: PageId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'ringkasan', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'estimasi', label: 'Estimasi 4R', icon: Search },
  { id: 'kasus', label: 'Basis kasus', icon: Database },
];

function pageFromHash(): PageId {
  const value = window.location.hash.replace('#', '');
  return pages.some((page) => page.id === value) ? (value as PageId) : 'ringkasan';
}

function App() {
  const [page, setPage] = useState<PageId>(pageFromHash);
  const [indexStatus, setIndexStatus] = useState<IndexStatusResponse | null>(null);

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const status = await api.indexStatus();
        if (!cancelled) {
          setIndexStatus(status);
        }
      } catch {
        if (!cancelled) {
          setIndexStatus(null);
        }
      }
    };
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 15_000);
    const onIndexChanged = () => {
      void load();
    };
    window.addEventListener(INDEX_CHANGED_EVENT, onIndexChanged);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(INDEX_CHANGED_EVENT, onIndexChanged);
    };
  }, [page]);

  const navigate = (target: string) => {
    const id = pages.some((item) => item.id === target) ? (target as PageId) : 'ringkasan';
    window.location.hash = id;
    setPage(id);
  };

  const index = indexStatus?.index;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 border-b border-hairline bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigate('ringkasan')}
            className="flex shrink-0 items-center gap-3"
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-[11px] font-semibold tracking-tight text-primary-foreground">
              CBR
            </span>
            <span className="hidden text-sm font-medium tracking-tight text-ink sm:inline">
              Estimasi Lama Hukuman Pidana
            </span>
          </button>

          <nav className="flex items-center gap-1" aria-label="Navigasi utama">
            {pages.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  aria-current={page === item.id ? 'page' : undefined}
                  className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors sm:text-sm ${
                    page === item.id
                      ? 'bg-surface-2 text-ink'
                      : 'text-ink-subtle hover:bg-surface-2 hover:text-ink'
                  }`}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <Badge variant={index?.status === 'ready' ? 'success' : 'outline'}>
              Indeks: {index === undefined ? 'memeriksa' : indexStatusLabel(index.status)}
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        {page === 'ringkasan' ? <OverviewPage onNavigate={navigate} /> : null}
        {page === 'estimasi' ? <EstimatePage /> : null}
        {page === 'kasus' ? <CasesPage /> : null}
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-ink-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            Estimasi pola historis, bukan penentuan hukuman. Data dan artefak tetap lokal.
          </span>
          <span className="font-mono">SQLite · NestJS · React · Docker</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
