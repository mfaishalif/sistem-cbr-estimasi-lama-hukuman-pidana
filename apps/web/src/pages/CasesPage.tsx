import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Database,
  FileSearch,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FieldHint, Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CaseForm } from '@/components/case-form';
import {
  api,
  type CaseListResponse,
  type CaseUnit,
  type FactValue,
} from '@/lib/api';
import {
  buildDraft,
  caseFormFromUnit,
  emptyCaseForm,
  parseOptionalOutcome,
  validateFacts,
  validateIdentity,
  type CaseFormState,
} from '@/lib/case-form';
import { formatDays } from '@/lib/display';
import { notifyIndexChanged } from '@/lib/index-status';

function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) {
    return null;
  }
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-[#ffb4b4]">
      <ul className="list-disc space-y-1 pl-5">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}

function factLabel(value: FactValue): string {
  if (value.type === 'boolean') {
    return value.value ? 'ya' : 'tidak';
  }
  if (value.type === 'number') {
    return `${value.value.toLocaleString('id-ID')}${value.unit ? ` ${value.unit}` : ''}`;
  }
  if (value.type === 'set') {
    try {
      const parsed: unknown = JSON.parse(value.value);
      return Array.isArray(parsed) ? parsed.join(', ') : value.value;
    } catch {
      return value.value;
    }
  }
  return value.value;
}

export function CasesPage() {
  const [list, setList] = useState<CaseListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const limit = 25;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseUnit | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [mode, setMode] = useState<'view' | 'edit' | 'create'>('view');
  const [form, setForm] = useState<CaseFormState>(emptyCaseForm);
  const [outcomeInput, setOutcomeInput] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      setList(await api.listCases({ limit, offset, q: query }));
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Daftar kasus tidak tersedia');
    } finally {
      setListLoading(false);
    }
  }, [offset, query]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const unit = await api.getCase(id);
      setDetail(unit);
      setForm(caseFormFromUnit(unit));
      setOutcomeInput(
        unit.outcome.actualSentenceDays === null
          ? ''
          : String(unit.outcome.actualSentenceDays),
      );
      setMode('view');
      setConfirmDelete(false);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Detail kasus tidak tersedia');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const selectCase = (id: string) => {
    setSelectedId(id);
    void loadDetail(id);
  };

  const startCreate = () => {
    setSelectedId(null);
    setDetail(null);
    setForm(emptyCaseForm());
    setOutcomeInput('');
    setFormErrors([]);
    setMode('create');
    setConfirmDelete(false);
  };

  const cancelEdit = () => {
    setFormErrors([]);
    if (mode === 'create') {
      setMode('view');
      setForm(emptyCaseForm());
      setOutcomeInput('');
      return;
    }
    if (detail !== null) {
      setForm(caseFormFromUnit(detail));
      setOutcomeInput(
        detail.outcome.actualSentenceDays === null
          ? ''
          : String(detail.outcome.actualSentenceDays),
      );
    }
    setMode('view');
  };

  const save = async () => {
    const errors: string[] = [];
    validateIdentity(form, errors);
    validateFacts(form, errors);
    const outcome = parseOptionalOutcome(outcomeInput, errors);
    const draft = buildDraft(form, outcome, errors);
    setFormErrors(errors);
    if (errors.length > 0) {
      return;
    }

    setSaving(true);
    try {
      const saved =
        mode === 'create'
          ? await api.createCase(draft)
          : await api.updateCase(selectedId as string, draft);
      setSelectedId(saved.id);
      setDetail(saved);
      setForm(caseFormFromUnit(saved));
      setOutcomeInput(
        saved.outcome.actualSentenceDays === null
          ? ''
          : String(saved.outcome.actualSentenceDays),
      );
      setMode('view');
      await loadList();
      notifyIndexChanged();
    } catch (error) {
      setFormErrors([
        error instanceof Error ? error.message : 'Kasus tidak dapat disimpan',
      ]);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (selectedId === null) {
      return;
    }
    setSaving(true);
    try {
      await api.deleteCase(selectedId);
      setSelectedId(null);
      setDetail(null);
      setMode('view');
      setConfirmDelete(false);
      await loadList();
      notifyIndexChanged();
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Kasus tidak dapat dihapus');
    } finally {
      setSaving(false);
    }
  };

  const total = list?.total ?? 0;
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="mb-3 text-[13px] font-medium uppercase tracking-[0.4px] text-ink-subtle">
            Basis kasus
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.8px] text-ink">
            CRUD unit kasus dan hasil aktual.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Fakta pra-putusan dipisahkan dari hasil aktual. Perubahan langsung aktif
            dan membatalkan indeks lama; estimasi berikutnya menunggu indeks baru.
          </p>
        </div>
        <Button onClick={startCreate}>
          <Plus />
          Kasus baru
        </Button>
      </header>

      {list !== null ? (
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-subtle">
          <Badge variant="outline">
            <Database className="size-3" aria-hidden />
            {total} unit · generasi {list.generation}
          </Badge>
          <span>Perubahan menghapus pengaruh kasus lama setelah indeks dibangun ulang.</span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">Daftar unit</CardTitle>
            <CardDescription>Cari pengadilan, nomor perkara, terdakwa, atau kategori.</CardDescription>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setOffset(0);
                setQuery(queryInput);
              }}
            >
              <Input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="Cari…"
                aria-label="Cari kasus"
              />
              <Button type="submit" variant="secondary" size="icon" aria-label="Terapkan pencarian">
                <FileSearch />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Muat ulang daftar"
                onClick={() => void loadList()}
              >
                <RefreshCw className={listLoading ? 'animate-spin' : undefined} />
              </Button>
            </form>
          </CardHeader>
          <CardContent className="space-y-2">
            {listError ? <ErrorList errors={[listError]} /> : null}
            {listLoading && list === null ? (
              <p className="flex items-center gap-2 py-4 text-sm text-ink-subtle">
                <Loader2 className="size-4 animate-spin" /> Memuat kasus…
              </p>
            ) : null}
            {list !== null && list.items.length === 0 ? (
              <p className="py-4 text-sm text-ink-subtle">
                Tidak ada unit kasus pada halaman ini.
              </p>
            ) : null}
            <ul className="divide-y divide-hairline">
              {list?.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => selectCase(item.id)}
                    className={`w-full rounded-md px-3 py-3 text-left transition-colors hover:bg-surface-2 ${
                      selectedId === item.id ? 'bg-surface-2' : ''
                    }`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink">
                        {item.court} · {item.caseNumber}
                      </span>
                      <Badge variant={item.actualSentenceDays === null ? 'outline' : 'default'}>
                        {item.actualSentenceDays === null
                          ? 'hasil belum diketahui'
                          : formatDays(item.actualSentenceDays)}
                      </Badge>
                    </span>
                    <span className="mt-1 block text-xs text-ink-subtle">
                      {item.defendantName ?? 'Terdakwa tanpa nama'} · {item.category ?? 'tanpa kategori'} ·{' '}
                      {item.articleCount} pasal · {item.sourceCount} sumber
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
          <div className="flex items-center justify-between border-t border-hairline px-6 pt-4 text-xs text-ink-subtle">
            <span>
              {total === 0 ? 0 : offset + 1}–{Math.min(offset + limit, total)} dari {total}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Halaman sebelumnya"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={!canPrev || listLoading}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Halaman berikutnya"
                onClick={() => setOffset(offset + limit)}
                disabled={!canNext || listLoading}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          {detailError ? <ErrorList errors={[detailError]} /> : null}

          {mode === 'create' || mode === 'edit' ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {mode === 'create' ? 'Tambah unit kasus' : 'Ubah unit kasus'}
                    </CardTitle>
                    <CardDescription>
                      Fakta dan hasil aktual disimpan terpisah. Tidak ada riwayat versi
                      atau verifikasi ahli tambahan.
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={cancelEdit} aria-label="Batal">
                    <X />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <CaseForm
                  idPrefix={mode === 'create' ? 'new-case' : 'edit-case'}
                  value={form}
                  onChange={setForm}
                  disabled={saving}
                />
                <div className="max-w-xs">
                  <Label htmlFor="case-outcome">Hasil aktual (hari)</Label>
                  <Input
                    id="case-outcome"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="mt-1.5"
                    value={outcomeInput}
                    onChange={(event) => setOutcomeInput(event.target.value)}
                    disabled={saving}
                  />
                  <FieldHint className="mt-1.5">
                    Kosongkan bila hasil putusan belum diketahui. Kasus tanpa hasil
                    aktual positif tidak dipakai sebagai referensi.
                  </FieldHint>
                </div>
                <ErrorList errors={formErrors} />
              </CardContent>
              <div className="flex justify-end gap-2 border-t border-hairline px-6 pt-4">
                <Button variant="ghost" onClick={cancelEdit} disabled={saving}>
                  Batal
                </Button>
                <Button onClick={() => void save()} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : null}
                  {saving ? 'Menyimpan…' : 'Simpan'}
                </Button>
              </div>
            </Card>
          ) : null}

          {detailLoading ? (
            <Card>
              <CardContent className="flex items-center gap-2 py-6 text-sm text-ink-subtle">
                <Loader2 className="size-4 animate-spin" /> Memuat detail…
              </CardContent>
            </Card>
          ) : null}

          {detail !== null && mode === 'view' ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {detail.identity.court} · {detail.identity.caseNumber}
                      </CardTitle>
                      <CardDescription>
                        {detail.identity.defendantName ?? 'Terdakwa tanpa nama'} · kelompok{' '}
                        <span className="font-mono">{detail.caseGroupId.slice(0, 8)}</span>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setMode('edit')}>
                        <Pencil />
                        Ubah
                      </Button>
                      {confirmDelete ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => void remove()}
                          disabled={saving}
                        >
                          <Trash2 />
                          Yakin hapus?
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(true)}
                        >
                          <Trash2 />
                          Hapus
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-lg border border-hairline bg-surface-2 p-4">
                    <h3 className="text-xs font-medium uppercase tracking-[0.4px] text-ink-subtle">
                      Fakta pra-putusan
                    </h3>
                    <dl className="mt-3 space-y-3 text-sm">
                      <div>
                        <dt className="text-xs text-ink-subtle">Narasi</dt>
                        <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-ink-muted">
                          {detail.facts.narration}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink-subtle">Kategori</dt>
                        <dd className="mt-0.5 text-ink-muted">
                          {detail.facts.category ?? 'Tidak diketahui'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink-subtle">Pasal dakwaan</dt>
                        <dd className="mt-1 flex flex-wrap gap-2 text-xs text-ink-muted">
                          {(detail.facts.articles ?? []).length === 0
                            ? 'Tidak ada'
                            : (detail.facts.articles ?? []).map((article, index) => (
                                <span
                                  key={`${article.law}-${article.article}-${index}`}
                                  className="rounded-full border border-hairline px-2 py-0.5"
                                >
                                  {article.law} {article.article}
                                  {article.paragraph ? ` ayat ${article.paragraph}` : ''} ·{' '}
                                  {article.arrangement ?? 'primary'}
                                </span>
                              ))}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink-subtle">Atribut</dt>
                        <dd className="mt-1">
                          {Object.keys(detail.facts.attributes ?? {}).length === 0 ? (
                            <span className="text-xs text-ink-subtle">Tidak ada atribut diketahui.</span>
                          ) : (
                            <dl className="grid gap-x-4 gap-y-1 text-xs text-ink-muted sm:grid-cols-[auto_1fr]">
                              {Object.entries(detail.facts.attributes ?? {}).map(([key, value]) => (
                                <div key={key} className="contents">
                                  <dt className="text-ink-subtle">{key}</dt>
                                  <dd>{factLabel(value)}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-lg border border-primary/25 bg-primary/10 p-4">
                    <h3 className="text-xs font-medium uppercase tracking-[0.4px] text-[#aab2ff]">
                      Hasil aktual
                    </h3>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                      {formatDays(detail.outcome.actualSentenceDays)}
                    </p>
                    <p className="mt-1 text-xs text-ink-subtle">
                      Berasal dari putusan. Bukan estimasi dan tidak diisi otomatis dari
                      prediksi.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-[0.4px] text-ink-subtle">
                      Sumber dan keterkaitan
                    </h3>
                    {detail.sources.length === 0 ? (
                      <p className="mt-1 text-xs text-ink-subtle">
                        Tidak ada sumber dokumen; kasus dibuat manual.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-xs text-ink-muted">
                        {detail.sources.map((source) => (
                          <li key={source.sourceDocumentId} className="rounded-md border border-hairline p-2">
                            <p className="font-mono">{source.snapshotPath}</p>
                            <p className="mt-1 text-ink-subtle">
                              hash {source.contentHash.slice(0, 12)}…
                              {source.sourceUrl ? (
                                <>
                                  {' · '}
                                  <a
                                    href={source.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    sumber asal
                                  </a>
                                </>
                              ) : null}
                            </p>
                            {source.aliases.length > 0 ? (
                              <p className="mt-1 text-ink-subtle">
                                alias: {source.aliases.join(', ')}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-3 text-xs text-ink-subtle">
                      Dibuat {detail.createdAt} · diperbarui {detail.updatedAt}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}

          {detail === null && mode === 'view' && !detailLoading ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-sm text-ink-muted">
                  Pilih unit kasus untuk melihat fakta, hasil aktual, dan sumbernya.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
