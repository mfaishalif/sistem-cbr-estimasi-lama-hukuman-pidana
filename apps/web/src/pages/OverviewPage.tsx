import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Database,
  FileCog,
  Gauge,
  Loader2,
  RefreshCw,
  ShieldCheck,
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
import {
  api,
  type ConfigResponse,
  type HealthResponse,
  type IndexStatusResponse,
} from '@/lib/api';
import { indexStatusLabel } from '@/lib/display';

const stages = [
  {
    name: 'Retrieve',
    description:
      'Mencari kasus historis yang mirip dari narasi wajib dan atribut opsional yang diketahui pada kedua sisi.',
  },
  {
    name: 'Reuse',
    description:
      'Menghitung rata-rata tertimbang hasil aktual referensi. Tidak ada aturan manual menambah atau mengurangi hukuman.',
  },
  {
    name: 'Revise',
    description:
      'Membandingkan estimasi dengan hasil aktual yang kemudian diketahui. Estimasi tidak berubah menjadi hasil aktual.',
  },
  {
    name: 'Retain',
    description:
      'Menambahkan kasus baru beserta hasil aktual putusan ke basis kasus; indeks lama dibatalkan.',
  },
];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="mt-1 font-mono text-sm text-ink">{value}</dd>
    </div>
  );
}

function IndexPanel({ status }: { status: IndexStatusResponse | null }) {
  if (status === null) {
    return <p className="text-sm text-ink-subtle">Membaca status indeks…</p>;
  }
  const index = status.index;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={
            index.status === 'ready'
              ? 'success'
              : index.status === 'failed'
                ? 'accent'
                : 'outline'
          }
        >
          {indexStatusLabel(index.status)}
        </Badge>
        <span className="text-xs text-ink-subtle">
          {index.status === 'ready'
            ? `generasi ${index.generation} · ${index.eligibleCaseCount}/${index.caseCount} unit layak`
            : index.status === 'building'
              ? 'pembangunan berjalan; estimasi menunggu'
              : index.status === 'stale'
                ? `alasan ${index.reason}`
                : 'indeks terakhir gagal'}
        </span>
      </div>
      {index.status === 'ready' ? (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Unit layak" value={index.eligibleCaseCount} />
          <Stat label="Istilah" value={index.termCount} />
          <Stat label="Waktu bangun" value={`${index.buildDurationMs} ms`} />
          <Stat label="Selesai" value={new Date(index.builtAt).toLocaleTimeString('id-ID')} />
        </dl>
      ) : null}
      {index.status === 'failed' ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-[#ffb4b4]">
          {index.message}
        </p>
      ) : null}
      <p className="font-mono text-[11px] text-ink-subtle">
        fingerprint {status.configFingerprint} · berkas {status.configSource}
      </p>
    </div>
  );
}

function ConfigPanel({ config }: { config: ConfigResponse | null }) {
  if (config === null) {
    return <p className="text-sm text-ink-subtle">Membaca konfigurasi…</p>;
  }
  const retrieval = config.config.retrieval;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-ink">
          Aktif dari <span className="font-mono text-xs">{config.displayPath}</span>
        </p>
        <p className="mt-1 text-xs text-ink-subtle">
          {config.persisted
            ? 'Berkas konfigurasi tersimpan ke basis data saat start.'
            : 'Berkas sama dengan konfigurasi tersimpan; tidak ada penulisan ulang.'}{' '}
          UI hanya menampilkan, bukan menyimpan angka tersembunyi.
        </p>
      </div>
      <dl className="grid gap-3 text-xs sm:grid-cols-2">
        <Stat label="maxReferences (k)" value={retrieval.maxReferences} />
        <Stat label="minReferences" value={retrieval.minReferences} />
        <Stat label="minScore" value={retrieval.minScore} />
        <Stat label="minAttributeCoverage" value={retrieval.minAttributeCoverage} />
      </dl>
      <details className="rounded-lg border border-hairline bg-surface-2 p-3">
        <summary className="cursor-pointer text-xs font-medium text-ink">
          Bobot komponen
        </summary>
        <dl className="mt-3 grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
          <div className="contents">
            <dt className="text-ink-subtle">narasi</dt>
            <dd className="font-mono">{config.config.components.narrativeWeight}</dd>
          </div>
          <div className="contents">
            <dt className="text-ink-subtle">pasal</dt>
            <dd className="font-mono">{config.config.components.articleWeight}</dd>
          </div>
          {config.config.components.attributes.map((attribute) => (
            <div key={attribute.attributeKey} className="contents">
              <dt className="text-ink-subtle">{attribute.attributeKey}</dt>
              <dd className="font-mono">
                {attribute.weight} · {attribute.comparator}
              </dd>
            </div>
          ))}
        </dl>
      </details>
      <p className="font-mono text-[11px] text-ink-subtle">
        fingerprint {config.fingerprint}
        {config.persistedUpdatedAt ? ` · diperbarui ${config.persistedUpdatedAt}` : ''}
      </p>
    </div>
  );
}

export function OverviewPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [indexStatus, setIndexStatus] = useState<IndexStatusResponse | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthResult, indexResult, configResult] = await Promise.all([
        api.health(),
        api.indexStatus(),
        api.config(),
      ]);
      setHealth(healthResult);
      setIndexStatus(indexResult);
      setConfig(configResult);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Status sistem tidak tersedia',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-12">
      <header className="max-w-3xl">
        <p className="mb-4 text-[13px] font-medium uppercase tracking-[0.4px] text-ink-subtle">
          Tugas kuliah · penalaran berbasis kasus
        </p>
        <h1 className="text-4xl font-semibold leading-[1.12] tracking-[-1.2px] text-ink sm:text-5xl sm:tracking-[-1.8px]">
          Estimasi lama hukuman pidana dari pengalaman putusan.
        </h1>
        <p className="mt-5 text-lg leading-relaxed tracking-[-0.1px] text-ink-muted">
          Aplikasi lokal untuk mahasiswa: basis kasus putusan Indonesia, alur
          Retrieve–Reuse–Revise–Retain, dan CRUD unit kasus. Sistem mengestimasi pola
          historis, bukan menentukan hukuman yang seharusnya.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => onNavigate('estimasi')}>
            Mulai estimasi 4R
            <ArrowRight />
          </Button>
          <Button variant="secondary" onClick={() => onNavigate('kasus')}>
            <BookOpen />
            Kelola basis kasus
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="size-4 text-ink-subtle" aria-hidden />
              Basis data
            </CardTitle>
            <CardDescription>SQLite persisten pada volume Docker.</CardDescription>
          </CardHeader>
          <CardContent>
            {health === null ? (
              <p className="text-sm text-ink-subtle">Membaca status…</p>
            ) : (
              <dl className="grid grid-cols-2 gap-4">
                <Stat label="Skema" value={health.database.schemaVersion ?? 'belum'} />
                <Stat label="Unit kasus" value={health.database.caseUnits} />
                <Stat label="Kelompok" value={health.database.caseGroups} />
                <Stat label="Generasi" value={health.database.generation} />
              </dl>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="size-4 text-ink-subtle" aria-hidden />
                Indeks Retrieve–Reuse
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void load()}
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Periksa
              </Button>
            </div>
            <CardDescription>
              Indeks derived selalu mengikuti generasi basis kasus dan konfigurasi aktif.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <IndexPanel status={indexStatus} />
          </CardContent>
          <CardFooter className="border-t border-hairline pt-4 text-xs text-ink-subtle">
            <ShieldCheck className="mr-2 size-3.5" aria-hidden />
            Indeks lama tidak dipakai saat pembangunan ulang atau setelah gagal.
          </CardFooter>
        </Card>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-[#ffb4b4]">
          {error}. Pastikan aplikasi berjalan melalui Docker Compose.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCog className="size-4 text-ink-subtle" aria-hidden />
            Konfigurasi retrieval aktif
          </CardTitle>
          <CardDescription>
            Parameter dipilih lewat berkas konfigurasi dan dapat ditelusuri; tidak
            diubah lewat angka tersembunyi di UI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfigPanel config={config} />
        </CardContent>
      </Card>

      <section>
        <h2 className="text-2xl font-semibold tracking-[-0.6px] text-ink">
          Empat tahap penalaran
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {stages.map((stage, indexNumber) => (
            <Card key={stage.name} className="gap-4 py-5">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">{stage.name}</CardTitle>
                  <Badge variant="outline">Tahap {indexNumber + 1}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-ink-muted">{stage.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mencoba dengan data sintetis</CardTitle>
          <CardDescription>
            Jalur singkat tanpa memakai data putusan nyata untuk pemeriksaan lokal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-muted">
            <li>
              Tambahkan dua atau tiga kasus sintetis lewat menu <strong>Basis kasus</strong>{' '}
              dengan narasi yang mirip dan hasil aktual positif.
            </li>
            <li>
              Buka <strong>Estimasi 4R</strong>, isi narasi kasus baru, lalu jalankan
              Retrieve. Referensi dan estimasi berasal dari kasus yang baru ditambahkan.
            </li>
            <li>
              Masukkan hasil aktual sintetis, terapkan Revise, lalu Retain. Estimasi awal
              tetap berbeda dari hasil aktual yang disimpan.
            </li>
          </ol>
          <p className="mt-3 text-xs text-ink-subtle">
            Panduan lengkap termasuk perintah Docker ada di README.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
