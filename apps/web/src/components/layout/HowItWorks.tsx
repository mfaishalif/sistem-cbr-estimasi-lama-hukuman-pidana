import { useEffect, useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { api, type ConfigResponse } from '@/lib/api';
import { formatNumber } from '@/lib/format';

const steps = [
  {
    term: 'Retrieve',
    meaning: 'mencari putusan serupa',
    body: 'Kronologi dibandingkan dengan kronologi putusan terdahulu memakai TF-IDF dan kemiripan kosinus. Pasal dakwaan dan detail perkara ikut dibandingkan bila tercatat di kedua sisi. Bila kategori dipilih, pencarian dibatasi pada kategori itu.',
  },
  {
    term: 'Reuse',
    meaning: 'menghitung estimasi',
    body: 'Hukuman putusan serupa dirata-rata dan ditimbang menurut tingkat kemiripannya. Bila putusan yang memenuhi syarat terlalu sedikit, estimasi tidak ditampilkan.',
  },
  {
    term: 'Revise',
    meaning: 'membandingkan dengan putusan aktual',
    body: 'Setelah putusan diketahui, lama penjara yang sebenarnya dibandingkan dengan estimasi untuk melihat selisihnya.',
  },
  {
    term: 'Retain',
    meaning: 'menyimpan ke basis kasus',
    body: 'Perkara beserta putusan aktualnya disimpan sehingga ikut menjadi pembanding pada estimasi berikutnya.',
  },
];

const evaluation = [
  { label: 'Perkara uji', value: '867' },
  { label: 'Cakupan estimasi', value: '98,62%', note: '855 dari 867 perkara mendapat estimasi' },
  { label: 'Rata-rata selisih (MAE)', value: '371,7 hari', note: 'pada perkara yang mendapat estimasi' },
  { label: 'Pembanding: median per kategori', value: '394,2 hari', note: 'MAE pada seluruh 867 perkara uji' },
];

function Formula({ children }: { children: string }) {
  return <p className="tabular rounded-md bg-surface-sunken px-4 py-3 text-[15px] text-ink">{children}</p>;
}

export function HowItWorks({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [config, setConfig] = useState<ConfigResponse | null>(null);

  useEffect(() => {
    if (!open || config !== null) return;
    api.config().then(setConfig, () => setConfig(null));
  }, [open, config]);

  const weights = config?.config.components;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Cara kerja" description="Penalaran berbasis kasus (Case-Based Reasoning) dalam empat langkah.">
      <div className="space-y-12">
        <ol className="space-y-6">
          {steps.map((step, index) => (
            <li key={step.term} className="grid grid-cols-[2rem_1fr] gap-x-2">
              <span className="font-serif text-lg font-semibold text-accent" aria-hidden>
                {index + 1}
              </span>
              <div>
                <h3 className="text-[15px] font-semibold text-ink">
                  {step.term} <span className="font-normal text-ink-subtle">· {step.meaning}</span>
                </h3>
                <p className="mt-1 text-[15px] text-ink-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="space-y-4">
          <h3 className="font-serif text-xl font-semibold text-ink">Rumus</h3>
          <div className="space-y-2">
            <p className="text-[15px] text-ink-muted">Tingkat kemiripan satu putusan:</p>
            <Formula>skor = Σ(bobot × kemiripan) ÷ Σ(bobot komponen yang dapat dibandingkan)</Formula>
            {weights === undefined ? null : (
              <p className="tabular text-sm text-ink-subtle">
                Bobot aplikasi: kronologi {formatNumber(weights.narrativeWeight)}, pasal dakwaan{' '}
                {formatNumber(weights.articleWeight)}, tiap detail perkara{' '}
                {formatNumber(Math.min(...weights.attributes.map((item) => item.weight)))}–
                {formatNumber(Math.max(...weights.attributes.map((item) => item.weight)))}.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[15px] text-ink-muted">Estimasi dari putusan serupa yang dipakai:</p>
            <Formula>estimasi = Σ(skor × hukuman) ÷ Σ(skor), dibulatkan ke hari terdekat</Formula>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="font-serif text-xl font-semibold text-ink">Hasil evaluasi</h3>
          <p className="text-[15px] text-ink-muted">
            Basis kasus Indo-Law (5.782 perkara) dibagi 70% latih, 15% validasi, dan 15% uji per kelompok perkara.
            Bobot dan ambang dipilih pada data validasi, lalu diukur sekali pada data uji.
          </p>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {evaluation.map((item) => (
              <div key={item.label}>
                <dt className="text-sm text-ink-subtle">{item.label}</dt>
                <dd className="tabular mt-0.5 font-serif text-2xl font-semibold text-ink">{item.value}</dd>
                {item.note === undefined ? null : <dd className="text-[13px] text-ink-subtle">{item.note}</dd>}
              </div>
            ))}
          </dl>
          <p className="text-[13px] text-ink-subtle">
            Angka evaluasi berasal dari konfigurasi evaluasi yang dikunci. Aplikasi memakai konfigurasi di{' '}
            <span className="tabular">{config?.displayPath ?? 'config/retrieval.json'}</span>
            {config === null ? '' : ` (sidik ${config.fingerprint})`}, sehingga hasil di aplikasi dapat berbeda.
          </p>
        </section>
      </div>
    </Sheet>
  );
}
