import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  CircleDashed,
  Database,
  ExternalLink,
  Layers,
  RefreshCw,
  Scale,
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

interface HealthResponse {
  status: string;
  service: string;
  time: string;
  database: {
    ok: boolean;
    schemaVersion: string | null;
    caseUnits: number;
    caseGroups: number;
    generation: number;
  };
}

type HealthState =
  | { kind: 'loading' }
  | { kind: 'ok'; data: HealthResponse }
  | { kind: 'error'; message: string };

async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health', { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`API membalas ${response.status}`);
  }
  return (await response.json()) as HealthResponse;
}

const stages = [
  {
    name: 'Retrieve',
    description:
      'Pencarian kasus historis yang mirip berdasarkan narasi dan atribut opsional yang benar-benar diketahui.',
  },
  {
    name: 'Reuse',
    description:
      'Estimasi dari rata-rata tertimbang hasil aktual kasus referensi, tanpa aturan hukuman manual.',
  },
  {
    name: 'Revise',
    description:
      'Penyesuaian hasil estimasi menggunakan hasil aktual yang kemudian diketahui.',
  },
  {
    name: 'Retain',
    description:
      'Penambahan kasus baru beserta hasil aktualnya ke basis kasus untuk estimasi berikutnya.',
  },
];

const foundation = [
  { label: 'React + Vite + komponen shadcn/ui', ready: true },
  { label: 'API NestJS pada prefix /api', ready: true },
  { label: 'SQLite: skema, migrasi, generasi basis kasus', ready: true },
  { label: 'Container tunggal dan volume data persisten', ready: true },
  { label: 'CLI migrasi, status, dan workspace evaluasi', ready: true },
  { label: 'Impor basis kasus dan alur 4R', ready: false },
];

function App() {
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setHealth({ kind: 'loading' });
    try {
      setHealth({ kind: 'ok', data: await fetchHealth() });
    } catch (error) {
      setHealth({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Tidak dapat menghubungi API',
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-[11px] font-semibold tracking-tight text-primary-foreground">
              CBR
            </span>
            <span className="text-sm font-medium tracking-tight text-ink">
              Estimasi Lama Hukuman Pidana
            </span>
          </div>
          <Badge variant="outline">Penggunaan lokal · satu pengguna</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-16">
        <section className="max-w-3xl">
          <p className="mb-4 text-[13px] font-medium uppercase tracking-[0.4px] text-ink-subtle">
            Tugas kuliah · penalaran berbasis kasus
          </p>
          <h1 className="text-4xl font-semibold leading-[1.15] tracking-[-1px] text-ink sm:text-5xl sm:tracking-[-1.8px]">
            Estimasi lama hukuman pidana dari pengalaman putusan.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed tracking-[-0.1px] text-ink-muted">
            Fondasi aplikasi sudah berjalan: antarmuka, API, basis data SQLite, dan
            perintah operasional. Impor basis kasus serta alur Retrieve–Reuse–Revise–Retain
            belum diimplementasikan, sehingga belum ada angka estimasi yang dihasilkan.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button onClick={() => void load()} disabled={health.kind === 'loading'}>
              <RefreshCw
                className={health.kind === 'loading' ? 'animate-spin' : undefined}
              />
              Periksa status sistem
            </Button>
            <Button variant="secondary" asChild>
              <a href="/api/health" target="_blank" rel="noreferrer">
                Lihat respons API
                <ExternalLink />
              </a>
            </Button>
          </div>
        </section>

        <section className="mt-14 grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="size-4 text-ink-subtle" aria-hidden />
                  Status sistem
                </CardTitle>
                {health.kind === 'ok' ? (
                  <Badge variant="success">API terhubung</Badge>
                ) : health.kind === 'error' ? (
                  <Badge variant="accent">API tidak terjangkau</Badge>
                ) : (
                  <Badge variant="outline">Memeriksa…</Badge>
                )}
              </div>
              <CardDescription>
                Diperiksa dari endpoint <code className="font-mono text-xs">/api/health</code>.
              </CardDescription>
            </CardHeader>
            <CardContent aria-live="polite">
              {health.kind === 'ok' ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-ink-subtle">Skema</dt>
                    <dd className="mt-1 font-mono text-sm text-ink">
                      {health.data.database.schemaVersion ?? 'belum'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-subtle">Unit kasus</dt>
                    <dd className="mt-1 font-mono text-sm text-ink">
                      {health.data.database.caseUnits}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-subtle">Kelompok</dt>
                    <dd className="mt-1 font-mono text-sm text-ink">
                      {health.data.database.caseGroups}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-subtle">Generasi</dt>
                    <dd className="mt-1 font-mono text-sm text-ink">
                      {health.data.database.generation}
                    </dd>
                  </div>
                </dl>
              ) : health.kind === 'error' ? (
                <p className="text-sm text-ink-muted">
                  {health.message}. Jalankan aplikasi melalui Docker Compose dan muat ulang
                  halaman.
                </p>
              ) : (
                <p className="text-sm text-ink-subtle">Membaca status basis data…</p>
              )}
            </CardContent>
            <CardFooter className="mt-auto gap-2 border-t border-hairline pt-4 text-xs text-ink-subtle">
              <ShieldCheck className="size-3.5" aria-hidden />
              Database disimpan pada volume persisten; tidak ada login untuk penggunaan lokal.
            </CardFooter>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="size-4 text-ink-subtle" aria-hidden />
                Ruang lingkup fondasi
              </CardTitle>
              <CardDescription>
                Yang tersedia pada tiket ini dan yang masih menunggu tiket lanjutan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {foundation.map((item) => (
                  <li key={item.label} className="flex items-start gap-2.5 text-sm">
                    {item.ready ? (
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0 text-success"
                        aria-hidden
                      />
                    ) : (
                      <CircleDashed
                        className="mt-0.5 size-4 shrink-0 text-ink-subtle"
                        aria-hidden
                      />
                    )}
                    <span className={item.ready ? 'text-ink' : 'text-ink-subtle'}>
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <section className="mt-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.6px] text-ink">
                Empat tahap penalaran
              </h2>
              <p className="mt-1 text-sm text-ink-subtle">
                Struktur modul bersama sudah tersedia; perilaku tiap tahap belum diklaim
                selesai.
              </p>
            </div>
            <Scale className="size-5 text-ink-subtle" aria-hidden />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {stages.map((stage) => (
              <Card key={stage.name} className="gap-4 py-5">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">{stage.name}</CardTitle>
                    <Badge variant="outline">Belum diimplementasikan</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-ink-muted">
                    {stage.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8 text-xs text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
          <span>Data dan artefak tetap lokal. Tidak ada layanan berbayar yang diwajibkan.</span>
          <span className="font-mono">SQLite · NestJS · React · Docker</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
