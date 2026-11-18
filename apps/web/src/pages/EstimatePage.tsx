import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  Loader2,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FieldHint, Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CaseForm } from '@/components/case-form';
import { api, type EstimateResult, type FactValue, type IndexStatusResponse, type ReferenceDetail } from '@/lib/api';
import {
  buildDraft,
  buildFacts,
  emptyCaseForm,
  parsePositiveOutcome,
  validateFacts,
  validateIdentity,
  type CaseFormState,
} from '@/lib/case-form';
import {
  estimateHeadline,
  formatDays,
  formatNumber,
  formatPercent,
  indexStatusLabel,
  rangeHeadline,
  withholdingMessage,
} from '@/lib/display';
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

function ReferenceCard({ reference }: { reference: ReferenceDetail }) {
  const attributes = Object.entries(reference.facts.attributes ?? {});
  return (
    <details className="group rounded-lg border border-hairline bg-surface-2">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2 p-4">
        <Badge variant="outline">#{reference.rank}</Badge>
        <span className="text-sm font-medium text-ink">
          {reference.identity.court} · {reference.identity.caseNumber}
        </span>
        {reference.identity.defendantName ? (
          <span className="text-xs text-ink-subtle">{reference.identity.defendantName}</span>
        ) : null}
        <span className="ml-auto flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
          <span>Skor {formatNumber(reference.score)}</span>
          <span aria-hidden>·</span>
          <span>Bobot {formatPercent(reference.reuse.weightShare)}</span>
          <span aria-hidden>·</span>
          <span className="text-ink">Aktual {formatDays(reference.actualSentenceDays)}</span>
        </span>
      </summary>

      <div className="space-y-4 border-t border-hairline px-4 py-4">
        <div>
          <h4 className="text-xs font-medium uppercase tracking-[0.4px] text-ink-subtle">
            Narasi referensi
          </h4>
          <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
            {reference.facts.narration}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h4 className="text-xs font-medium uppercase tracking-[0.4px] text-ink-subtle">
              Komponen skor
            </h4>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-ink-subtle">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Komponen</th>
                    <th className="py-1 pr-3 font-medium">Kemiripan</th>
                    <th className="py-1 pr-3 font-medium">Bobot</th>
                    <th className="py-1 font-medium">Kontribusi</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-ink-muted">
                  {reference.components.map((component) => (
                    <tr key={`${component.kind}-${component.key}`}>
                      <td className="py-1 pr-3">{component.key}</td>
                      <td className="py-1 pr-3">{formatNumber(component.similarity)}</td>
                      <td className="py-1 pr-3">{formatNumber(component.weight)}</td>
                      <td className="py-1">{formatNumber(component.contribution)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-medium uppercase tracking-[0.4px] text-ink-subtle">
                Perbandingan
              </h4>
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs text-ink-muted sm:grid-cols-[auto_1fr]">
                <dt className="text-ink-subtle">Cakupan atribut</dt>
                <dd>{formatPercent(reference.comparison.coverage)}</dd>
                <dt className="text-ink-subtle">Dibandingkan</dt>
                <dd>{reference.comparison.comparedAttributeKeys.join(', ') || '—'}</dd>
                <dt className="text-ink-subtle">Kandidat tidak punya</dt>
                <dd>{reference.comparison.missingCandidateAttributeKeys.join(', ') || '—'}</dd>
                <dt className="text-ink-subtle">Tidak sebanding</dt>
                <dd>{reference.comparison.notComparableAttributeKeys.join(', ') || '—'}</dd>
                <dt className="text-ink-subtle">Pasal dibandingkan</dt>
                <dd>{reference.comparison.articlesCompared ? 'ya' : 'tidak'}</dd>
              </dl>
            </div>
            <div>
              <h4 className="text-xs font-medium uppercase tracking-[0.4px] text-ink-subtle">
                Perhitungan Reuse
              </h4>
              <p className="mt-1 font-mono text-xs text-ink-muted">
                {formatNumber(reference.reuse.weight)} × {formatDays(reference.actualSentenceDays)} ={' '}
                {formatNumber(reference.reuse.weightedOutcomeDays)} hari-bobot
              </p>
            </div>
          </div>
        </div>

        {(reference.facts.articles ?? []).length > 0 ? (
          <div>
            <h4 className="text-xs font-medium uppercase tracking-[0.4px] text-ink-subtle">
              Pasal dakwaan
            </h4>
            <ul className="mt-1 flex flex-wrap gap-2 text-xs text-ink-muted">
              {(reference.facts.articles ?? []).map((article, index) => (
                <li
                  key={`${article.law}-${article.article}-${index}`}
                  className="rounded-full border border-hairline px-2 py-0.5"
                >
                  {article.law} {article.article}
                  {article.paragraph ? ` ayat ${article.paragraph}` : ''} ·{' '}
                  {article.arrangement ?? 'primary'}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {attributes.length > 0 ? (
          <div>
            <h4 className="text-xs font-medium uppercase tracking-[0.4px] text-ink-subtle">
              Atribut referensi
            </h4>
            <dl className="mt-1 grid gap-x-4 gap-y-1 text-xs text-ink-muted sm:grid-cols-[auto_1fr]">
              {attributes.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-ink-subtle">{key}</dt>
                  <dd>{factLabel(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        <div>
          <h4 className="text-xs font-medium uppercase tracking-[0.4px] text-ink-subtle">
            Sumber
          </h4>
          {reference.sources.length === 0 ? (
            <p className="mt-1 text-xs text-ink-subtle">Tidak ada sumber terlacak (kasus sintetis).</p>
          ) : (
            <ul className="mt-1 space-y-1 text-xs text-ink-muted">
              {reference.sources.map((source) => (
                <li key={source.sourceDocumentId}>
                  <span className="font-mono">{source.snapshotPath}</span>
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
                  {source.aliases.length > 0 ? (
                    <span className="text-ink-subtle"> · alias: {source.aliases.join(', ')}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}

export function EstimatePage() {
  const [form, setForm] = useState<CaseFormState>(emptyCaseForm);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [indexStatus, setIndexStatus] = useState<IndexStatusResponse | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [actualInput, setActualInput] = useState('');
  const [revisedDays, setRevisedDays] = useState<number | null>(null);
  const [reviseErrors, setReviseErrors] = useState<string[]>([]);
  const [retainedId, setRetainedId] = useState<string | null>(null);
  const [retaining, setRetaining] = useState(false);
  const [retainErrors, setRetainErrors] = useState<string[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);

  const refreshIndex = useCallback(async () => {
    try {
      setIndexStatus(await api.indexStatus());
      setIndexError(null);
    } catch (error) {
      setIndexError(error instanceof Error ? error.message : 'Status indeks tidak tersedia');
    }
  }, []);

  useEffect(() => {
    void refreshIndex();
  }, [refreshIndex]);

  useEffect(() => {
    if (!estimating) {
      return;
    }
    const timer = window.setInterval(() => {
      void refreshIndex();
    }, 1200);
    return () => window.clearInterval(timer);
  }, [estimating, refreshIndex]);

  useEffect(() => {
    if (estimate !== null) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [estimate]);

  const submitEstimate = async () => {
    const errors: string[] = [];
    validateFacts(form, errors);
    const facts = buildFacts(form, errors);
    setFormErrors(errors);
    if (errors.length > 0) {
      return;
    }

    setEstimating(true);
    setEstimateError(null);
    setEstimate(null);
    setRevisedDays(null);
    setRetainedId(null);
    setRetainErrors([]);
    setReviseErrors([]);
    setActualInput('');
    try {
      const result = await api.estimate(facts);
      setEstimate(result);
      await refreshIndex();
    } catch (error) {
      setEstimateError(
        error instanceof Error ? error.message : 'Estimasi tidak dapat dijalankan',
      );
    } finally {
      setEstimating(false);
    }
  };

  const applyRevise = () => {
    const errors: string[] = [];
    const days = parsePositiveOutcome(actualInput, errors);
    setReviseErrors(errors);
    if (days === null) {
      return;
    }
    setRevisedDays(days);
    setRetainedId(null);
    setRetainErrors([]);
  };

  const retainCase = async () => {
    const errors: string[] = [];
    validateIdentity(form, errors);
    validateFacts(form, errors);
    const outcome = parsePositiveOutcome(actualInput, errors);
    const draft = buildDraft(form, outcome, errors);
    setRetainErrors(errors);
    if (errors.length > 0 || outcome === null) {
      return;
    }

    setRetaining(true);
    try {
      const saved = await api.createCase(draft);
      setRetainedId(saved.id);
      await refreshIndex();
      notifyIndexChanged();
    } catch (error) {
      setRetainErrors([
        error instanceof Error ? error.message : 'Kasus tidak dapat ditambahkan',
      ]);
    } finally {
      setRetaining(false);
    }
  };

  const startNew = () => {
    setEstimate(null);
    setEstimateError(null);
    setActualInput('');
    setRevisedDays(null);
    setRetainedId(null);
    setReviseErrors([]);
    setRetainErrors([]);
  };

  const delta = useMemo(() => {
    if (revisedDays === null || estimate?.estimate.days == null) {
      return null;
    }
    return revisedDays - estimate.estimate.days;
  }, [estimate, revisedDays]);

  const index = indexStatus?.index;

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="mb-3 text-[13px] font-medium uppercase tracking-[0.4px] text-ink-subtle">
          Alur 4R · kasus baru
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.8px] text-ink sm:text-4xl sm:tracking-[-1.2px]">
          Estimasi dari fakta yang diketahui sebelum putusan.
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-muted">
          Isi fakta satu terdakwa–perkara. Sistem menjalankan Retrieve, menampilkan
          kasus referensi, lalu Reuse menghitung estimasi. Setelah hasil putusan
          diketahui, masukkan hasil aktual untuk Revise dan Retain. Estimasi tidak
          pernah disimpan sebagai hasil aktual.
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Fakta perkara</CardTitle>
              <CardDescription>
                Narasi wajib. Pasal dakwaan dan atribut lain hanya diisi bila benar-benar diketahui.
              </CardDescription>
            </div>
            <Badge variant={index?.status === 'ready' ? 'success' : 'outline'}>
              <Database className="size-3" aria-hidden />
              Indeks: {index === undefined ? 'memeriksa…' : indexStatusLabel(index.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <CaseForm idPrefix="estimate" value={form} onChange={setForm} disabled={estimating} />
          <div className="mt-6 space-y-3">
            <ErrorList errors={formErrors} />
            {estimateError ? <ErrorList errors={[estimateError]} /> : null}
            {index?.status === 'failed' ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-[#ffb4b4]">
                Indeks gagal dibangun: {index.message}. Estimasi akan ditahan sampai
                pembangunan berhasil.
              </p>
            ) : null}
          </div>
        </CardContent>
        <CardFooter className="justify-between gap-3 border-t border-hairline pt-4">
          <p className="text-xs text-ink-subtle">
            {estimating
              ? 'Retrieve berjalan. Indeks dibangun ulang bila basis kasus berubah.'
              : 'Hasil estimasi bukan putusan dan tidak menggantikan pertimbangan hukum.'}
          </p>
          <Button onClick={() => void submitEstimate()} disabled={estimating}>
            {estimating ? <Loader2 className="animate-spin" /> : <Search />}
            {estimating ? 'Menjalankan Retrieve…' : 'Jalankan Retrieve'}
          </Button>
        </CardFooter>
      </Card>

      {estimating ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-4 text-sm text-ink-muted">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
            {index?.status === 'building'
              ? 'Indeks sedang dibangun dari basis kasus terbaru…'
              : 'Menyiapkan indeks dan mencari kasus referensi…'}
          </CardContent>
        </Card>
      ) : null}

      {indexError ? <ErrorList errors={[indexError]} /> : null}

      {estimate ? (
        <div ref={resultRef} className="space-y-6 scroll-mt-24">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">
                    {estimate.status === 'estimated' ? 'Hasil Reuse' : 'Estimasi ditahan'}
                  </CardTitle>
                  <CardDescription>
                    Generasi basis kasus {estimate.caseBaseGeneration ?? '—'} · filter{' '}
                    {estimate.category.restriction === 'same-category'
                      ? `kategori ${estimate.category.requested ?? ''}`
                      : 'semua kategori'}
                  </CardDescription>
                </div>
                <Badge variant={estimate.status === 'estimated' ? 'success' : 'accent'}>
                  {estimate.status === 'estimated' ? (
                    <CheckCircle2 className="size-3" aria-hidden />
                  ) : (
                    <ShieldAlert className="size-3" aria-hidden />
                  )}
                  {estimate.status === 'estimated' ? 'Estimasi tersedia' : 'Tanpa angka'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {estimate.status === 'estimated' ? (
                <>
                  <p className="text-4xl font-semibold tracking-[-1px] text-ink">
                    {formatDays(estimate.estimate.days)}
                  </p>
                  <p className="text-sm text-ink-muted">{estimateHeadline(estimate)}</p>
                  {rangeHeadline(estimate) ? (
                    <p className="text-sm text-ink-muted">{rangeHeadline(estimate)}</p>
                  ) : null}
                  <div className="rounded-lg border border-hairline bg-surface-2 p-3 font-mono text-xs text-ink-muted">
                    ({estimate.estimate.numerator?.toFixed(4) ?? '—'}) ÷ (
                    {estimate.estimate.denominator?.toFixed(4) ?? '—'}) ={' '}
                    {estimate.estimate.rawDays?.toFixed(4) ?? '—'} →{' '}
                    {formatDays(estimate.estimate.days)} (pembulatan ke hari terdekat)
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#e0b36a]" aria-hidden />
                  <div>
                    <p className="text-sm leading-relaxed text-ink-muted">
                      {withholdingMessage(estimate)}
                    </p>
                    {estimate.withholding?.details ? (
                      <p className="mt-2 font-mono text-xs text-ink-subtle">
                        Kode: {estimate.withholding.code} · referensi:{' '}
                        {estimate.references.length}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              <dl className="grid gap-x-6 gap-y-3 border-t border-hairline pt-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-ink-subtle">Kandidat layak</dt>
                  <dd className="mt-0.5 font-mono text-ink">
                    {estimate.scoring.candidates.eligibleCaseCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">Setelah filter kategori</dt>
                  <dd className="mt-0.5 font-mono text-ink">
                    {estimate.scoring.candidates.afterCategoryCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">Skor / cakupan ditolak</dt>
                  <dd className="mt-0.5 font-mono text-ink">
                    {estimate.scoring.candidates.rejectedBelowScore} /{' '}
                    {estimate.scoring.candidates.rejectedCoverage}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">Referensi dipakai</dt>
                  <dd className="mt-0.5 font-mono text-ink">
                    {estimate.references.length} / maks {estimate.scoring.maxReferences}
                  </dd>
                </div>
              </dl>

              <details className="rounded-lg border border-hairline bg-surface-2 p-3">
                <summary className="cursor-pointer text-xs font-medium text-ink">
                  Konfigurasi dan perhitungan
                </summary>
                <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs text-ink-muted sm:grid-cols-2">
                  <div>
                    <dt className="text-ink-subtle">Fingerprint konfigurasi</dt>
                    <dd className="font-mono">{estimate.scoring.configFingerprint}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-subtle">Ambang</dt>
                    <dd className="font-mono">
                      skor &gt; {estimate.scoring.minScore} · cakupan ≥{' '}
                      {estimate.scoring.minAttributeCoverage} · min referensi{' '}
                      {estimate.scoring.minReferences}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-subtle">Bobot narasi / pasal / atribut</dt>
                    <dd className="font-mono">
                      {estimate.scoring.narrativeWeight} / {estimate.scoring.articleWeight} /{' '}
                      {formatNumber(estimate.scoring.configuredAttributeWeight)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-subtle">Rumus</dt>
                    <dd className="font-mono text-[11px]">
                      {estimate.scoring.similarityFormula}; {estimate.scoring.reuseFormula}
                    </dd>
                  </div>
                </dl>
              </details>
            </CardContent>
          </Card>

          {estimate.references.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Kasus referensi</CardTitle>
                <CardDescription>
                  Urutan dan skor berasal dari kemiripan fakta. Skor bukan probabilitas
                  kebenaran estimasi.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {estimate.references.map((reference) => (
                  <ReferenceCard key={reference.caseUnitId} reference={reference} />
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revise dan Retain</CardTitle>
              <CardDescription>
                Masukkan hasil aktual putusan setelah diketahui. Revise hanya
                membandingkan; Retain menambahkan kasus beserta hasil aktual itu ke
                basis kasus.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-sm">
                <Label htmlFor="actual-outcome">Hasil aktual (hari penjara)</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    id="actual-outcome"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={actualInput}
                    onChange={(event) => {
                      setActualInput(event.target.value);
                      setRevisedDays(null);
                      setRetainedId(null);
                    }}
                    disabled={retaining}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={applyRevise}
                    disabled={retaining}
                  >
                    Terapkan Revise
                  </Button>
                </div>
                <FieldHint className="mt-1.5">
                  Retain membutuhkan hasil aktual positif. Prediksi tidak dijadikan
                  hasil aktual secara otomatis.
                </FieldHint>
              </div>

              {reviseErrors.length > 0 ? <ErrorList errors={reviseErrors} /> : null}
              {retainErrors.length > 0 ? <ErrorList errors={retainErrors} /> : null}

              {revisedDays !== null ? (
                <div className="rounded-lg border border-hairline bg-surface-2 p-3 text-sm text-ink-muted">
                  <p>
                    Hasil aktual <span className="font-mono text-ink">{formatDays(revisedDays)}</span>
                    {estimate.estimate.days !== null ? (
                      <>
                        {' '}dibandingkan estimasi{' '}
                        <span className="font-mono text-ink">
                          {formatDays(estimate.estimate.days)}
                        </span>
                        {delta !== null ? (
                          <>
                            {' '}· selisih{' '}
                            <span className="font-mono text-ink">
                              {delta > 0 ? '+' : ''}
                              {delta.toLocaleString('id-ID')} hari
                            </span>
                          </>
                        ) : null}
                      </>
                    ) : (
                      ' · estimasi sebelumnya ditahan, jadi tidak ada angka pembanding.'
                    )}
                  </p>
                  <p className="mt-1 text-xs text-ink-subtle">
                    Revise belum mengubah basis kasus. Tekan Retain untuk menyimpan.
                  </p>
                </div>
              ) : null}

              {retainedId ? (
                <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-[#9fe9b3]">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <div>
                    Kasus tersimpan sebagai unit {retainedId}. Indeks basis kasus
                    dibangun ulang untuk estimasi berikutnya. Retain tidak diulang
                    untuk sesi ini agar tidak menambah salinan.
                  </div>
                </div>
              ) : null}
            </CardContent>
            <CardFooter className="flex-wrap justify-between gap-3 border-t border-hairline pt-4">
              <p className="text-xs text-ink-subtle">
                Hasil aktual harus berasal dari putusan, bukan angka estimasi.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={startNew} disabled={retaining}>
                  Estimasi baru
                </Button>
                <Button
                  onClick={() => void retainCase()}
                  disabled={revisedDays === null || retainedId !== null || retaining}
                >
                  {retaining ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                  {retaining ? 'Menyimpan…' : 'Retain ke basis kasus'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
