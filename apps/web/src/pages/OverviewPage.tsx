import { ArrowRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const similarityComponents = [
  {
    name: 'Narasi fakta perkara',
    weight: '1',
    method:
      'TF-IDF memberi bobot pada kata sesuai frekuensi dan kekhasannya di Basis Kasus. Kemiripan kosinus membandingkan pola kata berbobot antar narasi.',
  },
  {
    name: 'Pasal dakwaan',
    weight: '0,5',
    method:
      'Jaccard membagi jumlah pasal yang sama dengan jumlah pasal unik dari kedua kasus setelah format pasalnya diseragamkan.',
  },
  {
    name: 'Atribut opsional',
    weight: '0,1–0,2 per atribut',
    method:
      'Sistem mengecek kesamaan nilai kategori, tumpang tindih daftar nilai, atau jarak angka pada skala yang dibentuk dari kasus referensi.',
  },
];

const exampleReferences = [
  { name: 'Kasus A', narrative: '0,7', charges: '1', score: '0,8', actual: '240 hari' },
  { name: 'Kasus B', narrative: '0,6', charges: '0', score: '0,4', actual: '420 hari' },
];

const evaluationSplits = [
  {
    name: 'Training',
    count: '70% · 4.048 unit',
    purpose: 'Menyediakan kasus referensi, kosakata, bobot kata, skala angka, dan median pembanding.',
  },
  {
    name: 'Validasi',
    count: '15% · 867 unit',
    purpose: 'Memilih MAE terendah dari 32 kandidat dengan syarat cakupan estimasi minimal 90%.',
  },
  {
    name: 'Test',
    count: '15% · 867 unit',
    purpose: 'Mengukur hasil pada unit yang disisihkan setelah bobot dan ambang dikunci.',
  },
];

const errorMetrics = [
  { name: 'MAE', meaning: 'Rata-rata besar selisih.', cbr: '371,7', median: '393,9' },
  {
    name: 'RMSE',
    meaning: 'Akar rata-rata kuadrat selisih, sehingga galat besar lebih berpengaruh.',
    cbr: '660,8',
    median: '746,8',
  },
  { name: 'MedAE', meaning: 'Nilai tengah besar selisih.', cbr: '223,1', median: '240,0' },
];

function RetrieveStep() {
  return (
    <Card>
      <CardHeader>
        <CardTitle><h3>Retrieve · Cari kasus serupa</h3></CardTitle>
        <CardDescription className="leading-relaxed">
          Kandidat perlu memiliki narasi dan hasil aktual positif. Saat pengguna memilih
          kategori, pencarian bawaan memakai kasus dari kategori itu. Jika kategori kosong,
          pencarian mencakup semua kategori.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 text-sm leading-relaxed text-ink-muted">
        <div>
          <h4 className="font-semibold text-ink">Cara membandingkan dan bobot bawaan</h4>
          <dl className="mt-2 grid gap-4 md:grid-cols-3">
            {similarityComponents.map(({ name, weight, method }) => (
              <div key={name} className="border-t border-hairline pt-3">
                <dt className="font-medium text-ink">{name}</dt>
                <dd className="mt-1">
                  <span className="block font-mono text-xs text-ink">Bobot {weight}</span>
                  <p className="mt-2">{method}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-col gap-2">
          <p className="rounded-lg bg-surface-2 p-3 font-mono text-xs leading-relaxed text-ink sm:text-sm">
            Skor kemiripan = Σ(bobot × kemiripan) ÷ Σ(bobot yang dapat dibandingkan)
          </p>
          <p>
            Pasal dan atribut masuk hitungan jika nilainya tersedia dan bisa dibandingkan pada
            kedua kasus. <strong className="text-ink">Cakupan komponen opsional</strong> adalah
            bagian bobot pasal dan atribut yang berhasil dibandingkan dari total bobot isian
            opsional kasus baru. Jika input hanya berisi narasi dan kategori, cakupannya 100%.
          </p>
          <p>
            Sistem memeringkat kandidat berdasarkan skor. Setelan bawaan mengambil hingga
            lima referensi berskor di atas 0 dan membutuhkan minimal satu referensi. Rincian
            parameter yang dipakai untuk tiap perhitungan tersedia di Estimasi 4R.
          </p>
        </div>

        <div>
          <table className="w-full text-left text-xs sm:text-sm">
            <caption className="mb-2 text-left font-semibold text-ink">
              Dua referensi pada contoh pencurian
            </caption>
            <thead className="text-ink-subtle">
              <tr className="border-b border-hairline">
                <th scope="col" className="py-2 pr-1 font-medium">Referensi</th>
                <th scope="col" className="p-1 font-medium">Skor narasi</th>
                <th scope="col" className="p-1 font-medium">Skor pasal</th>
                <th scope="col" className="p-1 font-medium">Skor gabungan</th>
                <th scope="col" className="py-2 pl-1 font-medium">Hasil aktual</th>
              </tr>
            </thead>
            <tbody>
              {exampleReferences.map(({ name, narrative, charges, score, actual }) => (
                <tr key={name} className="border-b border-hairline">
                  <th scope="row" className="py-2 pr-1 font-medium text-ink">{name}</th>
                  <td className="p-1 tabular-nums">{narrative}</td>
                  <td className="p-1 tabular-nums">{charges}</td>
                  <td className="p-1 font-semibold tabular-nums text-ink">{score}</td>
                  <td className="py-2 pl-1 tabular-nums">{actual}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2">
            Pasal Kasus A cocok, sehingga skornya{' '}
            <span className="font-mono text-xs text-ink">
              (1 × 0,7 + 0,5 × 1) ÷ (1 + 0,5) = 0,8
            </span>.
            Kasus B memiliki pasal yang berbeda sehingga skor pasalnya 0.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function EvaluationSection() {
  return (
    <section className="flex flex-col gap-5" aria-labelledby="evaluasi-indo-law">
      <div className="max-w-3xl">
        <h2 id="evaluasi-indo-law" className="text-2xl font-semibold tracking-tight text-ink">
          Evaluasi Indo-Law
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Studi ini memakai salinan Indo-Law dari satu versi. Unit dari perkara yang sama
          atau dari perkara terkait yang teridentifikasi ditempatkan dalam satu bagian.
        </p>
      </div>

      <ol role="list" className="grid gap-4 sm:grid-cols-3">
        {evaluationSplits.map(({ name, count, purpose }) => (
          <li key={name}>
            <Card className="h-full gap-3">
              <CardHeader>
                <CardTitle><h3>{name}</h3></CardTitle>
                <CardDescription className="font-mono text-xs">{count}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-ink-muted">
                {purpose}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle><h3>Hasil uji pada 867 unit</h3></CardTitle>
          <CardDescription className="max-w-3xl leading-relaxed">
            Model CBR gabungan memakai bobot narasi 0,75, pasal 0,20, dan kelompok atribut 0,05.
            Model ini mensyaratkan 2–5 referensi, skor di atas 0,10, dan cakupan komponen
            opsional minimal 85% pada tiap referensi.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm leading-relaxed text-ink-muted">
          <p>
            <strong className="font-semibold text-ink">Cakupan estimasi 98,62%</strong>{' '}
            berarti 855 dari 867 unit layak mendapat angka estimasi. Estimasi ditahan untuk
            12 unit. Untuk membandingkan galat, kedua metode pada tabel dinilai pada 855 unit
            yang sama.
          </p>
          <table className="w-full table-fixed text-left text-xs sm:text-sm">
            <caption className="mb-2 text-left font-semibold text-ink">
              Galat terhadap hasil aktual dalam hari
            </caption>
            <thead className="text-ink-subtle">
              <tr className="border-b border-hairline">
                <th scope="col" className="w-1/2 py-2 pr-2 font-medium">Metrik</th>
                <th scope="col" className="p-1 font-medium">CBR gabungan berbobot</th>
                <th scope="col" className="py-2 pl-1 font-medium">Median per kategori</th>
              </tr>
            </thead>
            <tbody>
              {errorMetrics.map(({ name, meaning, cbr, median }) => (
                <tr key={name} className="border-b border-hairline align-top">
                  <th scope="row" className="py-2 pr-2 font-normal">
                    <span className="block font-medium text-ink">{name}</span>
                    {meaning}
                  </th>
                  <td className="px-1 py-2 font-semibold tabular-nums text-ink">{cbr}</td>
                  <td className="py-2 pl-1 tabular-nums">{median}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Pembanding mengambil nilai tengah hasil aktual training pada kategori yang sama,
            atau median seluruh training jika median kategori tidak tersedia. Pada pengujian
            ini, MAE CBR lebih rendah 22,2 hari secara keseluruhan. Untuk kategori pencurian,
            pembanding median memiliki MAE lebih rendah.
          </p>
          <a
            href="https://github.com/mfaishalif/sistem-cbr-estimasi-lama-hukuman-pidana/blob/53c2ba4f06b305ddaae90501208d642ce30f3252/docs/evaluation/indo-law-evaluation.md"
            className="self-start rounded-sm font-medium text-ink underline underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
          >
            Baca laporan evaluasi Indo-Law
          </a>
        </CardContent>
      </Card>
    </section>
  );
}

export function OverviewPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <div className="flex flex-col gap-10 sm:gap-12">
      <header className="max-w-3xl">
        <h1 className="text-4xl font-semibold leading-[1.12] tracking-[-1.2px] text-ink sm:text-5xl sm:tracking-[-1.8px]">
          Cara kerja estimasi lama hukuman
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-muted">
          Penalaran berbasis kasus (CBR) memperkirakan lama pidana penjara dengan
          membandingkan fakta yang diketahui sebelum putusan dengan perkara terdahulu
          di Basis Kasus. Angka yang dihasilkan menggambarkan pola putusan historis.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button onClick={() => onNavigate('estimasi')}>
            Mulai estimasi 4R
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button variant="secondary" onClick={() => onNavigate('kasus')}>
            <BookOpen data-icon="inline-start" />
            Buka Basis Kasus
          </Button>
        </div>
      </header>

      <section className="flex flex-col gap-4" aria-labelledby="masukan">
        <h2 id="masukan" className="text-2xl font-semibold tracking-tight text-ink">
          Masukan kasus baru
        </h2>
        <dl className="grid gap-4 text-sm leading-relaxed text-ink-muted sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-ink">Wajib · Narasi fakta perkara</dt>
            <dd className="mt-1">
              Uraikan kejadian dan dugaan keterlibatan terdakwa dari informasi yang diketahui
              sebelum putusan. Hasil aktual baru dimasukkan setelah putusan diketahui.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Opsional · Kategori, pasal dakwaan, atribut</dt>
            <dd className="mt-1">
              Isi bila diketahui, misalnya kategori perbuatan, daftar pasal dakwaan, peran,
              kerugian, atau jumlah korban.
            </dd>
          </div>
        </dl>
        <p className="rounded-lg border border-hairline bg-surface-1 p-4 text-sm leading-relaxed text-ink-muted">
          <strong className="text-ink">Contoh rekaan.</strong> Sebuah sepeda motor dilaporkan
          diambil dari area parkir tanpa izin pemilik. Mahasiswa memasukkan narasi itu,
          memilih kategori pencurian, dan mengisi satu pasal dakwaan yang diketahui.
        </p>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="alur-4r">
        <h2 id="alur-4r" className="text-2xl font-semibold tracking-tight text-ink">
          Proses 4R dan pembobotan
        </h2>
        <ol role="list" className="grid gap-4 sm:grid-cols-2">
          <li className="min-w-0 sm:col-span-2"><RetrieveStep /></li>
          <li className="min-w-0 sm:col-span-2">
            <Card className="gap-3">
              <CardHeader>
                <CardTitle><h3>Reuse · Hitung estimasi</h3></CardTitle>
                <CardDescription className="leading-relaxed">
                  Kalikan hasil aktual tiap referensi dengan skor kemiripannya, jumlahkan, lalu
                  bagi dengan total skor. Kasus yang lebih mirip berpengaruh lebih besar.
                  Sistem membulatkan ke hari terdekat, dengan pecahan 0,5 dibulatkan ke atas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="rounded-lg bg-surface-2 p-3 font-mono text-xs leading-relaxed text-ink sm:text-sm">
                  (0,8 × 240 + 0,4 × 420) ÷ (0,8 + 0,4) = <strong>300 hari</strong>
                </p>
              </CardContent>
            </Card>
          </li>
          <li>
            <Card className="h-full gap-3">
              <CardHeader>
                <CardTitle><h3>Revise · Catat hasil aktual</h3></CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-ink-muted">
                Setelah putusan diketahui, Revise mencatat lama hukuman yang dijatuhkan dan
                menampilkan selisih jika angka estimasi tersedia. Pada contoh ini, hasil
                aktual 330 hari berarti selisih <strong className="text-ink">+30 hari</strong>.
              </CardContent>
            </Card>
          </li>
          <li>
            <Card className="h-full gap-3">
              <CardHeader>
                <CardTitle><h3>Retain · Simpan pengalaman</h3></CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-ink-muted">
                Simpan fakta perkara beserta hasil aktual <strong className="text-ink">330 hari</strong> ke
                Basis Kasus. Setelah indeks pencarian diperbarui, kasus dapat dipakai sebagai
                referensi berikutnya.
              </CardContent>
            </Card>
          </li>
        </ol>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="keluaran">
        <h2 id="keluaran" className="text-2xl font-semibold tracking-tight text-ink">
          Keluaran estimasi
        </h2>
        <dl className="grid gap-4 text-sm leading-relaxed text-ink-muted sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-ink">Estimasi tersedia</dt>
            <dd className="mt-1">
              Dalam contoh, keluarannya 300 hari dengan rentang hasil aktual referensi
              240–420 hari. Di Estimasi 4R, setiap referensi menyertakan hasil aktual,
              rincian skor, serta sumber jika tercatat.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Estimasi ditahan</dt>
            <dd className="mt-1">
              Sistem menampilkan alasan seperti narasi tanpa istilah yang dikenali, jumlah
              referensi yang belum memenuhi syarat, atau indeks pencarian yang belum siap.
            </dd>
          </div>
        </dl>
      </section>

      <section className="max-w-3xl" aria-labelledby="data-kasus">
        <h2 id="data-kasus" className="text-2xl font-semibold tracking-tight text-ink">
          Data di Basis Kasus
        </h2>
        <div className="mt-2 flex flex-col gap-3 text-sm leading-relaxed text-ink-muted">
          <p>
            Satu unit kasus memuat fakta perkara dan hasil aktual untuk satu terdakwa dalam
            satu perkara. Basis Kasus aplikasi berisi unit dari impor atau catatan pengguna,
            beserta sumber putusan jika tersedia.
          </p>
          <p>
            Dari 22.630 berkas XML Indo-Law, impor untuk studi menerima 5.782 unit dalam 5.773
            kelompok perkara. Impor memilih putusan pidana umum berkekuatan hukum tetap
            dengan pidana penjara berjangka positif dan narasi fakta yang dapat dipisahkan
            dari hasil putusan. Durasi dikonversi ke hari dengan 30 hari per bulan dan 360
            hari per tahun.
          </p>
          <p>
            Data studi mencakup 20 kategori tercatat. Pencurian paling banyak, dengan 1.639
            unit, dan 1.335 unit belum memiliki kategori. Kelengkapan atribut bervariasi,
            misalnya usia dengan tanggal acuan tersedia untuk 907 unit.
          </p>
        </div>
      </section>

      <EvaluationSection />
    </div>
  );
}
