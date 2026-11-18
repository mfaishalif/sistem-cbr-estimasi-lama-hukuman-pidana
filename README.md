# Estimasi Lama Hukuman Pidana

Aplikasi tugas kuliah untuk mengestimasi lama hukuman pidana dengan penalaran
berbasis kasus (CBR) atas pengalaman putusan pengadilan Indonesia.

Tiket fondasi ini membangun **struktur aplikasi, skema SQLite, CLI, dan Docker**.
Impor basis kasus, mesin Retrieve–Reuse, integrasi CRUD/4R, dan evaluasi akhir
belum diimplementasikan. Antarmuka menampilkan status sistem dan menandai tahap
4R sebagai belum tersedia; tidak ada angka estimasi yang diklaim dihasilkan.

## Prasyarat

- Docker Engine dengan Docker Compose v2.
- Untuk pengembangan tanpa Docker: Node.js 24.20.x dan npm 11.

## Menjalankan aplikasi

```bash
docker compose up --build
```

Buka <http://localhost:3000>. Satu container menyajikan build React dan API
NestJS. Port host sengaja diikat ke loopback (`127.0.0.1:3000`); aplikasi ini
untuk satu pengguna lokal tanpa login.

Menghentikan tanpa menghapus data:

```bash
docker compose stop          # hentikan container
docker compose down          # hapus container, volume data tetap
```

`docker compose down -v` **menghapus volume database secara permanen**. Tidak
ada perintah aplikasi yang menghapus data secara diam-diam; reset hanya terjadi
bila Anda menjalankan `down -v` atau menghapus volume sendiri.

## Lokasi data

| Data | Lokasi | Keterangan |
| --- | --- | --- |
| Database aplikasi | volume Docker `cbr-estimasi-lama-hukuman_app-data`, file `/data/app.db` | Persisten setelah container dibuat ulang; tidak masuk Git/image. |
| Sumber mentah | `./data/raw` di host, dipasang `/sources` **read-only** | Diisi terpisah dari build image; tidak masuk Git/image. |
| Workspace evaluasi | `./data/evaluation` di host, dipasang `/workspace` | Database evaluasi sendiri (`evaluation.db`), terpisah dari database aplikasi. |
| Artefak evaluasi | `./artifacts/evaluation` di host, dipasang `/artifacts` | Ekspor laporan/artefak agar dapat dibaca dan dijalankan ulang. |

Periksa nama volume:

```bash
docker compose config --volumes
docker volume ls | grep cbr-estimasi-lama-hukuman
```

Sebelum menjalankan perintah impor/evaluasi pertama kali, buat folder host agar
container non-root dapat menulisnya:

```bash
mkdir -p data/raw data/evaluation artifacts/evaluation
```

Pada Linux native, pastikan folder tersebut dapat ditulis oleh uid container
(image Node memakai user `node`, biasanya uid 1000).

Data aplikasi dapat dicadangkan dengan menyalin `/data/app.db` keluar dari
container. Hentikan aplikasi lebih dulu agar SQLite menutup koneksi dan
memindahkan isi WAL ke file utama:

```bash
docker compose stop app
docker compose cp app:/data/app.db ./backup-app.db
docker compose start app
```

Jangan menyalin file database saat aplikasi sedang menulis. `docker compose
down -v` menghapus data dan bukan prosedur pencadangan. Folder `data/`,
`artifacts/`, cache, file SQLite, dan `audit/` dikecualikan dari Git serta build
context image.

## Migrasi

Migrasi dijalankan otomatis dan idempoten oleh entrypoint aplikasi saat start.
Perintah manual:

```bash
# Di dalam image, terhadap database aplikasi
docker compose run --rm --entrypoint node app \
  tools/cli/dist/index.js migrate --database /data/app.db

# Status skema, jumlah unit/kelompok, generasi basis kasus
docker compose run --rm --entrypoint node app \
  tools/cli/dist/index.js status --database /data/app.db
```

Migrasi pertama membuat skema awal: unit kasus (terdakwa–perkara), kelompok
perkara, sumber/alias/snapshot/hash/lokasi bukti, pasal dakwaan, atribut fakta
opsional, hasil aktual, konfigurasi, dan penanda generasi basis kasus. Tidak ada
audit log atau riwayat versi kasus.

## CLI

CLI dan API memakai paket bersama yang sama (`@cbr/core`, `@cbr/data`).

```bash
docker compose run --rm --entrypoint node app \
  tools/cli/dist/index.js help

# Tambah satu unit kasus sintetis (untuk pemeriksaan persistensi).
# Layanan `import` memasang volume aplikasi dan sumber mentah read-only.
docker compose --profile tools run --rm import \
  create-case --file /sources/synthetic.json
```

`create-case` menerima JSON dengan bentuk:

```json
{
  "court": "PN Contoh",
  "caseNumber": "1/Pid.B/2024/PN Contoh",
  "defendantName": "Sintetis",
  "narration": "Narasi fakta sintetis sebelum putusan.",
  "category": "pencurian",
  "actualSentenceDays": 180,
  "articles": [{ "law": "KUHP", "article": "362", "arrangement": "primary" }],
  "attributes": {
    "age_years": { "type": "number", "value": 27, "unit": "tahun" },
    "prior_conviction": { "type": "enum", "value": "no" }
  }
}
```

Semantik nilai:

- Atribut yang tidak diketahui **tidak ditulis sebagai baris**; bukan nol dan
  bukan "tidak ada".
- Nilai yang secara eksplisit "tidak/belum" ditulis eksplisit, misalnya
  `prior_conviction: "no"`.
- `actualSentenceDays` adalah hasil aktual putusan, bukan estimasi. Tidak ada
  kolom estimasi pada tabel unit kasus.

## Impor dan evaluasi

Perintah memakai image yang sama dan tidak berjalan pada startup aplikasi biasa.

```bash
# Siapkan sumber mentah di host (tidak masuk Git/image)
mkdir -p data/raw

# Hentikan aplikasi sebelum impor besar
docker compose stop app

# Impor (belum diimplementasikan pada tiket fondasi; keluar dengan kode 2
# dan tidak menulis apa pun)
docker compose --profile tools run --rm import

# Workspace evaluasi terpisah (menyiapkan database evaluasi + manifest;
# pipeline evaluasi belum diimplementasikan)
docker compose --profile tools run --rm evaluate
```

 Batas yang sudah disiapkan:

- Sumber mentah dipasang read-only; impor besar hanya saat aplikasi berhenti.
- Evaluasi tidak memasang volume database aplikasi dan memakai
  `data/evaluation/evaluation.db` sendiri.
- Sumber mentah dipasang read-only pada layanan impor dan evaluasi.
- Artefak ditulis ke `artifacts/evaluation`, bukan ke volume aplikasi.
- Pengambilan dataset bukan bagian dari build image.

Pemeriksaan isolasi mount (aplikasi harus sedang berjalan):

```bash
docker compose up -d --build
node scripts/verify-mount-isolation.mjs
```

Skrip membandingkan hash `/data/app.db` sebelum/sesudah evaluasi dan memastikan
`/data/app.db` tidak ada di container evaluasi.

### Fungsi pembagian dan metrik evaluasi

`tools/cli/src/evaluation/` berisi fungsi murni yang nantinya dipakai perintah
`evaluate` (integrasi impor, konfigurasi, dan test terkunci ada pada tiket CLI
evaluasi):

- `buildSplitManifest(units, { seed, proportions })` membagi training,
  validasi, dan test per kelompok perkara. Setiap unit masuk tepat sekali, satu
  kelompok tidak pernah terpecah, dan urutan masukan tidak mengubah hasil.
  `emptySplits` dilaporkan agar pemanggil dapat menghentikan eksperimen.
- `buildMedianBaseline(units)` dan `baselineDaysFor` menghitung median training
  keseluruhan serta per kategori. Kategori kosong atau tidak ditemukan di
  training memakai median keseluruhan.
- `evaluatePredictions(predictions, baseline)` menghitung MAE, RMSE, MedAE,
  jumlah estimasi diterima/ditahan beserta alasannya, cakupan, dan pembanding
  median pada unit yang persis sama maupun seluruh unit layak. Penyebut nol
  menghasilkan status `unavailable`, bukan `0` atau `NaN`.

Seed, proporsi akhir, ambang, dan konfigurasi produksi tetap menjadi parameter
pemanggil sampai keputusan konfigurasi evaluasi ditetapkan. Perintah pengujian:

```bash
npm run test:evaluation
```

## Pengembangan tanpa Docker

```bash
npm ci
npm run build          # paket bersama, API, dan frontend
npm test               # unit test data layer, CLI, dan isolasi paket CBR

# API + frontend hasil build pada http://localhost:3000
DATABASE_PATH=./data/app.db WEB_DIST_DIR=./apps/web/dist npm start

# Frontend dev server dengan proxy /api ke API lokal
npm run dev:web
npm run dev:api

# Typecheck seluruh workspace
npm run typecheck
```

Di PowerShell, atur environment variable dengan `$env:DATABASE_PATH = ...`
sebelum `npm start`.

## Struktur

```text
apps/web        React + Vite + shadcn/ui (token visual dari design.md)
apps/api        NestJS: HTTP /api, menyajikan build frontend
packages/cbr    Model domain dan kontrak bersama; tanpa HTTP/browser/filesystem
packages/data   Akses SQLite, migrasi, repository
tools/cli       Migrasi, status, create-case, impor, workspace evaluasi
docker/         Entrypoint image
scripts/        Pemeriksaan operasional
```

Batas tanggung jawab: API, impor, dan evaluasi memakai implementasi bersama;
mesin CBR nantinya menerima fakta, konfigurasi, dan data indeks dari pemanggil
tanpa bergantung pada browser atau NestJS. Indeks TF-IDF adalah turunan basis
kasus: setiap perubahan unit/atribut/pasal/konfigurasi menaikkan generasi basis
kasus sehingga indeks lama tidak boleh dipakai.

## Pemeriksaan tiket fondasi

1. `npm ci && npm run typecheck && npm test && npm run build`
2. `docker compose up --build`, lalu buka `http://localhost:3000` dan
   `http://localhost:3000/api/health`.
3. Migrasi database kosong: hapus volume **hanya untuk pemeriksaan** dengan
   `docker compose down -v`, lalu `docker compose up --build`; status skema
   harus `001`.
4. Persistensi: tambahkan unit kasus sintetis melalui `create-case`, lalu
   `docker compose up -d --force-recreate`; jumlah unit harus tetap.
5. Isolasi mount: jalankan `node scripts/verify-mount-isolation.mjs` dan
   pastikan hash database aplikasi tidak berubah.
