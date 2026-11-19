import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { CaseDrawer } from '@/components/cases/CaseDrawer';
import { CaseEditor } from '@/components/cases/CaseEditor';
import { CaseTable } from '@/components/cases/CaseTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api, type CaseListResponse } from '@/lib/api';
import { copy } from '@/lib/copy';
import { formatInteger } from '@/lib/format';
import { caseHref } from '@/lib/route';
import { CATEGORIES } from '@/lib/vocabulary';

const LIMIT = 20;

export function CasesPage({ caseId }: { caseId: string | null }) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [offset, setOffset] = useState(0);
  const [list, setList] = useState<CaseListResponse | null>(null);
  const [baseTotal, setBaseTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(search.trim());
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // TEMPORARY: the category filter rides on `q` (which also matches court,
  // case number and name) until the API offers `category=`. Search text and
  // category are therefore mutually exclusive; choosing one clears the other.
  const q = debounced !== '' ? debounced : category;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.listCases({ limit: LIMIT, offset, q });
      setList(response);
      if (q === '') setBaseTotal(response.total);
    } catch (caught) {
      setError(`Daftar perkara tidak dapat dimuat: ${caught instanceof Error ? caught.message : 'server tidak menjawab'}.`);
    } finally {
      setLoading(false);
    }
  }, [offset, q]);

  useEffect(() => {
    void load();
  }, [load, reload]);

  const refresh = () => setReload((value) => value + 1);
  const total = list?.total ?? 0;
  const items = list?.items ?? [];
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + LIMIT, total);

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="font-heading text-[32px] font-semibold leading-tight text-ink sm:text-[40px]">{copy.cases.title}</h1>
          <p className="text-[17px] text-ink-muted">
            {baseTotal === null ? ' ' : `${formatInteger(baseTotal)} perkara beserta putusannya.`}
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          {copy.cases.add}
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
        <div className="space-y-1.5">
          <Label htmlFor="cases-search">{copy.cases.searchLabel}</Label>
          <Input
            id="cases-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              if (event.target.value !== '') setCategory('');
            }}
            placeholder={copy.cases.searchPlaceholder}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cases-category">{copy.cases.categoryFilter}</Label>
          <Select
            id="cases-category"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setSearch('');
              setDebounced('');
              setOffset(0);
            }}
          >
            <option value="">{copy.cases.allCategories}</option>
            {CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <section aria-label="Daftar perkara" aria-busy={loading} className="space-y-6">
        {error !== null ? (
          <div role="alert" className="space-y-3">
            <p className="text-[15px] text-ink">{error}</p>
            <Button onClick={refresh}>{copy.result.retry}</Button>
          </div>
        ) : list === null ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-6 animate-pulse rounded-sm bg-surface-sunken" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-[15px] text-ink-muted">{q === '' ? copy.cases.emptyBase : copy.cases.empty}</p>
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : undefined}>
            <CaseTable items={items} />
          </div>
        )}

        {total > 0 ? (
          <nav aria-label="Halaman daftar" className="flex flex-wrap items-center justify-between gap-3">
            <p className="tabular text-sm text-ink-subtle">
              {formatInteger(from)}–{formatInteger(to)} dari {formatInteger(total)}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setOffset(Math.max(0, offset - LIMIT))} disabled={offset === 0 || loading}>
                {copy.cases.previous}
              </Button>
              <Button size="sm" onClick={() => setOffset(offset + LIMIT)} disabled={offset + LIMIT >= total || loading}>
                {copy.cases.next}
              </Button>
            </div>
          </nav>
        ) : null}
      </section>

      <CaseDrawer
        caseId={caseId}
        onClose={() => {
          window.location.hash = caseHref(null);
        }}
        onChanged={refresh}
      />
      <CaseEditor
        open={creating}
        onOpenChange={setCreating}
        onSaved={(saved) => {
          setCreating(false);
          refresh();
          window.location.hash = caseHref(saved.id);
        }}
      />
    </div>
  );
}
