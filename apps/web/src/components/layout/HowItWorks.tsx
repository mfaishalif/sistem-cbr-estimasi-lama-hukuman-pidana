import { useEffect, useState, type ReactNode } from 'react';
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

interface ComponentRow {
  field: string;
  /** Key in `config.components.attributes`; absent for kronologi and pasal dakwaan. */
  attributeKey?: string;
  configKey?: 'narrativeWeight' | 'articleWeight';
  method: ReactNode;
  formula: string;
  /** Shown until the live config has loaded. */
  configWeightFallback: string;
  coverage: ReactNode;
}

const componentRows: ComponentRow[] = [
  {
    field: 'Kronologi',
    configKey: 'narrativeWeight',
    method: (
      <>
        TF-IDF (<em>smoothed IDF</em>) + cosine similarity, memakai <em>inverted index</em>
      </>
    ),
    formula: 'Σ w(t,q)·w(t,d) ÷ (‖q‖·‖d‖), dengan w = tf × [ln((N+1)/(df+1)) + 1]',
    configWeightFallback: '0,75',
    coverage: '5.782 (100%)',
  },
  {
    field: 'Pasal dakwaan',
    configKey: 'articleWeight',
    method: 'Jaccard similarity',
    formula: '|A∩B| ÷ |A∪B|',
    configWeightFallback: '0,2',
    coverage: '5.140 (89%)',
  },
  {
    field: 'Jenis kelamin',
    attributeKey: 'gender',
    method: 'Exact match (komponen kategorikal Gower)',
    formula: 'sama = 1, beda = 0',
    configWeightFallback: '0,05 ÷ n',
    coverage: '3.306 (57%)',
  },
  {
    field: 'Umur',
    attributeKey: 'age_years',
    method: 'Selisih absolut ternormalisasi rentang (komponen numerik Gower)',
    formula: '1 − |a−b| ÷ 68',
    configWeightFallback: '0,05 ÷ n',
    coverage: '907 (16%)',
  },
  {
    field: 'Pendidikan',
    attributeKey: 'education',
    method: 'Exact match',
    formula: 'sama = 1, beda = 0',
    configWeightFallback: '0,05 ÷ n',
    coverage: '1.004 (17%)',
  },
  {
    field: 'Pekerjaan',
    attributeKey: 'occupation',
    method: 'Exact match',
    formula: 'sama = 1, beda = 0',
    configWeightFallback: '0,05 ÷ n',
    coverage: '4.056 (70%)',
  },
  {
    field: 'Riwayat dihukum',
    attributeKey: 'prior_conviction',
    method: 'Exact match',
    formula: 'sama = 1, beda = 0',
    configWeightFallback: '0,05 ÷ n',
    coverage: '1.112 (19%)',
  },
  {
    field: 'Peran',
    attributeKey: 'role',
    method: 'Exact match',
    formula: 'sama = 1, beda = 0',
    configWeightFallback: '0,05 ÷ n',
    coverage: '26 (0,4%)',
  },
  {
    field: 'Akibat pada korban',
    attributeKey: 'victim_harm',
    method: 'Jaccard similarity',
    formula: '|A∩B| ÷ |A∪B|',
    configWeightFallback: '0,05 ÷ n',
    coverage: '398 (7%)',
  },
  {
    field: 'Cara atau alat',
    attributeKey: 'weapon_or_mode',
    method: 'Jaccard similarity',
    formula: '|A∩B| ÷ |A∪B|',
    configWeightFallback: '0,05 ÷ n',
    coverage: '1.783 (31%)',
  },
  {
    field: 'Jumlah korban',
    attributeKey: 'victim_count',
    method: 'Selisih absolut ternormalisasi rentang',
    formula: '1 − |a−b| ÷ (max−min); bila max = min: sama = 1, beda = 0',
    configWeightFallback: '0,05 ÷ n',
    coverage: <strong className="font-semibold text-ink">1</strong>,
  },
  {
    field: 'Kerugian',
    attributeKey: 'loss_amount_idr',
    method: 'Selisih absolut ternormalisasi rentang setelah transformasi log (log1p)',
    formula: '1 − |ln(1+a)−ln(1+b)| ÷ 19,12',
    configWeightFallback: '0,05 ÷ n',
    coverage: '1.085 (19%)',
  },
];

const componentNotes = [
  'n adalah jumlah detail perkara yang diisi di kueri.',
  'Komponen yang tidak diketahui di salah satu sisi dikeluarkan dari pembilang dan penyebut skor.',
  'Persentase kasus berisi dihitung terhadap 5.782 unit basis kasus Indo-Law.',
  'Tidak ada library: semua rumus ditulis sendiri di packages/cbr/src/.',
  'Nama rumus adalah identifikasi berdasarkan kesamaan matematis. Kode sendiri tidak menyebut nama-nama itu.',
];

type Components = ConfigResponse['config']['components'];

function configWeight(row: ComponentRow, weights: Components | undefined): string {
  if (weights === undefined) return row.configWeightFallback;
  if (row.configKey !== undefined) return formatNumber(weights[row.configKey]);
  if (weights.attributeGroupWeight !== undefined) return `${formatNumber(weights.attributeGroupWeight)} ÷ n`;
  const attribute = weights.attributes.find((item) => item.attributeKey === row.attributeKey);
  return attribute === undefined ? '–' : formatNumber(attribute.weight);
}

function Formula({ children }: { children: string }) {
  return <p className="tabular rounded-md bg-surface-sunken px-4 py-3 text-[15px] text-ink">{children}</p>;
}

function Method({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-subtle">{children}</p>;
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
              <span className="font-heading text-lg font-semibold text-accent" aria-hidden>
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
          <h3 className="font-heading text-xl font-semibold text-ink">Rumus</h3>
          <div className="space-y-2">
            <p className="text-[15px] text-ink-muted">Tingkat kemiripan satu putusan:</p>
            <Formula>skor = Σ(bobot × kemiripan) ÷ Σ(bobot komponen yang dapat dibandingkan)</Formula>
            <Method>Koefisien kemiripan Gower berbobot</Method>
            {weights === undefined ? null : (
              <p className="tabular text-sm text-ink-subtle">
                Bobot aplikasi: kronologi {formatNumber(weights.narrativeWeight)}, pasal dakwaan{' '}
                {formatNumber(weights.articleWeight)},{' '}
                {weights.attributeGroupWeight === undefined ? (
                  <>
                    tiap detail perkara{' '}
                    {formatNumber(Math.min(...weights.attributes.map((item) => item.weight)))}–
                    {formatNumber(Math.max(...weights.attributes.map((item) => item.weight)))}
                  </>
                ) : (
                  <>kelompok atribut {formatNumber(weights.attributeGroupWeight)}</>
                )}
                .
              </p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[15px] text-ink-muted">Estimasi dari putusan serupa yang dipakai:</p>
            <Formula>estimasi = Σ(skor × hukuman) ÷ Σ(skor), dibulatkan ke hari terdekat</Formula>
            <Method>
              Weighted k-nearest neighbors regression + <em>round half up</em>
            </Method>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="font-heading text-xl font-semibold text-ink">Kemiripan per komponen</h3>
          <ul className="divide-y divide-rule border-y border-rule">
            {componentRows.map((row) => (
              <li key={row.field} className="space-y-2 py-4">
                <div>
                  <h4 className="text-[15px] font-semibold text-ink">{row.field}</h4>
                  <p className="text-sm text-ink-muted">{row.method}</p>
                </div>
                <Formula>{`s = ${row.formula}`}</Formula>
                <dl className="tabular grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-ink-subtle">Bobot aplikasi</dt>
                    <dd className="text-ink">{configWeight(row, weights)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-subtle">Kasus berisi</dt>
                    <dd className="text-ink">{row.coverage}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-subtle">
            {componentNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      </div>
    </Sheet>
  );
}
