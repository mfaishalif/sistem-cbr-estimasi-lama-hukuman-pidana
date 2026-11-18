# Estimasi Lama Hukuman Pidana

Aplikasi tugas kuliah untuk mengestimasi lama hukuman pidana dengan penalaran
berbasis kasus (CBR) atas pengalaman putusan pengadilan Indonesia.

Fondasi aplikasi menyediakan **struktur aplikasi, skema SQLite, CLI, dan Docker**.
Impor dan normalisasi basis kasus Indo-Law sudah diimplementasikan: perintah
`import` menghasilkan unit terdakwa–perkara, sumber/alias/hash, hasil aktual
dalam hari, pasal dakwaan, atribut opsional, kelompok perkara, serta laporan
kelolosan. Mesin Retrieve–Reuse bersama tersedia di `packages/cbr` dengan indeks
TF-IDF, atribut opsional berbobot, penahanan estimasi yang terjelaskan, dan
siklus rebuild yang tidak memakai indeks basi.

API NestJS dan UI React kini mendukung alur **Retrieve–Reuse–Revise–Retain**
beserta CRUD unit kasus. Mahasiswa dapat mengisi fakta pra-putusan, melihat
kasus referensi dan perhitungan Reuse, membandingkan hasil aktual (Revise), lalu
menyimpan kasus beserta hasil aktual tersebut (Retain). CRUD mempertahankan
sumber dan kelompok perkara, memisahkan fakta dari hasil aktual, dan membatalkan
indeks lama saat data berubah. Tidak ada verifikasi ahli atau riwayat versi;
estimasi tidak pernah disimpan sebagai hasil aktual. Konfigurasi retrieval aktif
dibaca dari [`config/retrieval.json`](config/retrieval.json) dan ditampilkan di
UI, bukan diubah lewat angka tersembunyi. Pipeline evaluasi sudah terhubung ke
CLI: impor ke workspace terpisah, split kelompok, validasi grid, konfigurasi
terkunci, dan penilaian test beserta pembanding. Hasil eksperimen Indo-Law tetap
merupakan pekerjaan terpisah. Rincian mesin dan benchmark:
[`docs/cbr/retrieve-reuse.md`](docs/cbr/retrieve-reuse.md).

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

## Panduan singkat: data sintetis dan alur 4R

Panduan ini memakai data sintetis, bukan putusan nyata. Jangan memasukkan hasil
estimasi sebagai hasil aktual; isi hasil aktual hanya dari putusan yang sudah
diketahui.

1. Jalankan `docker compose up --build`, lalu buka <http://localhost:3000>.
   Periksa badge indeks dan kartu **Konfigurasi retrieval aktif** di Ringkasan.
2. Buka **Basis kasus** → **Kasus baru**. Tambahkan dua atau tiga kasus sintetis
   dengan pengadilan, nomor perkara, narasi pra-putusan, kategori yang sama
   (misalnya `pencurian`), dan hasil aktual yang berbeda (misalnya 240, 360, dan
   540 hari). Pasal dan atribut boleh dikosongkan.
3. Buka **Estimasi 4R**, isi narasi serupa dan kategori yang sama, lalu tekan
   **Jalankan Retrieve**. Periksa angka Reuse, rentang hasil aktual referensi,
   komponen skor, perbandingan atribut, sumber, dan perhitungan berbobot.
4. Untuk **Revise**, isi **Hasil aktual (hari penjara)** dari putusan dan tekan
   **Terapkan Revise**. UI hanya membandingkan hasil aktual dengan estimasi;
   basis kasus belum berubah.
5. Untuk **Retain**, tekan **Retain ke basis kasus**. Kasus baru disimpan dengan
   hasil aktual tersebut, bukan dengan angka estimasi. Indeks lama dibatalkan;
   estimasi berikutnya membangun indeks dari basis kasus terbaru.
6. Di **Basis kasus**, coba **Ubah** dan **Hapus**. Perubahan menaikkan generasi
   basis kasus dan membuat indeks lama tidak dipakai. Kasus yang dihapus tidak
   lagi menjadi referensi setelah indeks dibangun ulang.
7. Hentikan dan jalankan ulang container tanpa `down -v`; jumlah unit dan hasil
   aktual harus tetap ada.

Bila narasi kosong, permintaan ditolak sebelum estimasi. Bila tidak ada kasus
yang memenuhi syarat, UI menampilkan kode dan alasan penahanan
(`TIDAK_ADA_REFERENSI_KATEGORI`, `REFERENSI_TIDAK_CUKUP`, dan seterusnya) tanpa
mengisi angka. Status indeks dapat berupa `siap`, `perlu dibangun ulang`,
`sedang dibangun`, atau `gagal`; estimasi ditahan selama indeks belum siap.

Konfigurasi aktif berada di [`config/retrieval.json`](config/retrieval.json) dan
disalin ke image saat build. Untuk mengubahnya, edit file tersebut lalu jalankan
`docker compose up --build`; UI hanya menampilkan konfigurasi yang tersimpan,
tidak menyediakan angka tersembunyi yang dapat diubah.

### Endpoint API

| Metode | Path | Kegunaan |
| --- | --- | --- |
| `GET` | `/api/health` | Status aplikasi, skema, jumlah unit, dan generasi. |
| `POST` | `/api/estimates` | Retrieve + Reuse untuk satu fakta pra-putusan; mengembalikan referensi, skor, perhitungan, atau alasan penahanan. |
| `GET` | `/api/index/status` | Status indeks dan fingerprint konfigurasi aktif. |
| `GET` | `/api/config` | Konfigurasi retrieval aktif beserta sumber file. |
| `GET` | `/api/cases` | Daftar unit kasus dengan pencarian dan paginasi. |
| `GET` | `/api/cases/:id` | Detail fakta, hasil aktual, sumber, dan kelompok. |
| `POST` | `/api/cases` | Tambah unit kasus (dipakai Retain dan CRUD). |
| `PUT` | `/api/cases/:id` | Ganti fakta/identitas/hasil aktual satu unit. |
| `PATCH` | `/api/cases/:id/outcome` | Ubah hasil aktual saja. |
| `DELETE` | `/api/cases/:id` | Hapus unit dan bersihkan kelompok yatim. |

Semua endpoint berada di bawah `/api`; tidak ada autentikasi karena aplikasi ini
untuk satu pengguna lokal.

## Lokasi data

| Data | Lokasi | Keterangan |
| --- | --- | --- |
| Database aplikasi | volume Docker `cbr-estimasi-lama-hukuman_app-data`, file `/data/app.db` | Persisten setelah container dibuat ulang; tidak masuk Git/image. |
| Sumber mentah | `./data/raw` di host, dipasang `/sources` **read-only** | Diisi terpisah dari build image; tidak masuk Git/image. |
| Laporan impor | `./artifacts/import/import-report.json` di host | Ringkasan jumlah, alasan dilewati, kategori, kelengkapan atribut, dan waktu. Tidak memuat isi narasi. |
| Laporan benchmark | `./artifacts/benchmark/retrieve-reuse.json` di host | Fase startup/rebuild, distribusi latensi pencarian, RAM proses, mesin, data, dan konfigurasi. Tidak memuat narasi. |
| Workspace evaluasi | `./data/evaluation` di host, dipasang `/workspace` | Database evaluasi sendiri (`evaluation.db`), terpisah dari database aplikasi. |
| Artefak evaluasi | `./artifacts/evaluation` di host, dipasang `/artifacts` | Manifest, split, laporan validasi/test, dan konfigurasi terkunci. |
| Workspace evaluasi fixture | `./data/evaluation-fixture` di host | Workspace terpisah untuk alur Docker pada fixture sintetis. |
| Artefak evaluasi fixture | `./artifacts/evaluation-fixture` di host | Artefak fixture; bukan hasil evaluasi Indo-Law. |

Periksa nama volume:

```bash
docker compose config --volumes
docker volume ls | grep cbr-estimasi-lama-hukuman
```

Sebelum menjalankan perintah impor/evaluasi pertama kali, buat folder host agar
container non-root dapat menulisnya:

```bash
mkdir -p data/raw data/evaluation artifacts/evaluation artifacts/import artifacts/benchmark
mkdir -p data/evaluation-fixture artifacts/evaluation-fixture
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
opsional, hasil aktual, konfigurasi, dan penanda generasi basis kasus. Migrasi
`002` menambahkan provenance hasil impor pada penghubung unit–sumber: ekspresi
durasi sumber dan jenis dukungannya (metadata saja atau metadata yang cocok
dengan teks putusan). Tidak ada audit log atau riwayat versi kasus.

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

### Benchmark mesin Retrieve–Reuse

Setelah basis kasus diimpor, ukur kecepatan dengan indeks siap:

```bash
docker compose run --rm --entrypoint node app \
  tools/cli/dist/index.js benchmark \
  --database /data/app.db \
  --queries 500 \
  --warmup 20 \
  --report /artifacts/benchmark/retrieve-reuse.json
```

Atau tanpa Docker:

```bash
node tools/cli/dist/index.js benchmark \
  --database data/app.db \
  --queries 500 \
  --warmup 20 \
  --report artifacts/benchmark/retrieve-reuse.json
```

Laporan memisahkan pembacaan snapshot dan pembangunan indeks dari latensi
pencarian, lalu mencatat mesin, ukuran data, fingerprint konfigurasi, distribusi
latensi, dan snapshot RAM. Target tiket adalah pencarian ≤ 2 detik; laporan
menyatakan apakah target terpenuhi untuk data yang benar-benar diukur. Angka
kecepatan bukan klaim akurasi estimasi. Rincian hasil pengukuran subset impor
penuh ada di [`docs/cbr/retrieve-reuse.md`](docs/cbr/retrieve-reuse.md).

## Impor dan evaluasi

Perintah memakai image yang sama dan tidak berjalan pada startup aplikasi biasa.
Impor **mengganti** basis kasus (bukan menambahkan duplikat), mempertahankan
konfigurasi aplikasi, dan harus dijalankan saat aplikasi berhenti. Sumber mentah
dipasang read-only; isi dataset tidak ditulis ke laporan atau repo.

### 1. Akuisisi snapshot resmi (di host)

```bash
npm ci
npm run build:packages
npm run source:acquire -- --destination data/raw/indo-law
```

Perintah mengunduh arsip resmi pada commit tetap
`67340338adbc63021630947d905627eef0d7e43f`, mengekstraknya, lalu menulis
`manifest.json` berisi SHA-256 arsip dan setiap XML. Prasyarat ekstraksi: `tar`
(Windows) atau `unzip` (Linux/macOS). Gunakan `--archive <path>` untuk memakai
ZIP yang sudah diunduh dan `--force` untuk mengulang ekstraksi.

### 2. Impor basis kasus

```bash
# Hentikan aplikasi sebelum impor besar
docker compose stop app

# Snapshot ada di ./data/raw/indo-law; laporan ke ./artifacts/import
docker compose --profile tools run --rm import
```

Tanpa Docker:

```bash
node tools/cli/dist/index.js import \
  --source data/raw/indo-law \
  --database data/app.db \
  --report artifacts/import/import-report.json
```

Pemeriksaan cepat pada sebagian XML memakai `--limit <n>`. Laporan berisi jumlah
dokumen diterima/dilewati beserta alasannya, kategori yang lolos, kelengkapan
atribut, hasil aktual menurut jenis dukungan, salinan/kelompok/konflik, ukuran
dan waktu pemrosesan. Laporan tidak memuat narasi, nama, atau nomor perkara.

Rincian aturan ekstraksi, hasil uji snapshot penuh, dan batasnya:
[`docs/import/indo-law-import.md`](docs/import/indo-law-import.md).

### 3. Evaluasi: impor, validasi, dan test terkunci

```bash
# Alur penuh pada snapshot Indo-Law (membutuhkan data/raw/indo-law)
docker compose --profile tools run --rm evaluate
```

Perintah menjalankan tiga tahap pada database evaluasi sendiri di
`data/evaluation/evaluation.db` dan menulis artefak ke
`artifacts/evaluation/`:

1. **prepare** mengimpor snapshot read-only, membangun split kelompok 70/15/15
   dengan seed `indo-law-cbr-v1`, dan mencatat identitas snapshot, anggota serta
   kelompok setiap split, konfigurasi, dan fingerprint di
   `evaluation-manifest.json` dan `split-manifest.json`.
2. **validate** memakai training saja untuk basis kasus, kosakata, IDF, skala
   numerik, dan median pembanding. Grid 32 kombinasi yang disetujui dijalankan
   pada validasi. Kandidat dengan cakupan minimal 90% dipilih berdasarkan MAE
   terendah, lalu cakupan tertinggi, lalu urutan grid; bila target tidak
   tercapai, cakupan tertinggi dipakai dan laporan menyatakan target belum
   tercapai. Hasilnya ditulis ke `validation-report.json` dan konfigurasi
   dikunci di `locked-config.json`. Test belum dibaca.
3. **test** menolak berjalan bila manifest, snapshot, atau konfigurasi terkunci
   tidak cocok. Setelah cocok, test menilai konfigurasi terkunci beserta dua
   varian: narasi saja dengan Reuse berbobot dan input gabungan dengan agregasi
   aritmetika tanpa bobot. Hasil dan pembanding median ditulis ke
   `test-report.json`.

Tahap dapat dipisah untuk pemeriksaan:

```bash
docker compose --profile tools run --rm evaluate --stage prepare
docker compose --profile tools run --rm evaluate --stage validate
docker compose --profile tools run --rm evaluate --stage test
```

Tanpa Docker:

```bash
node tools/cli/dist/index.js evaluate \
  --source data/raw/indo-law \
  --workspace data/evaluation \
  --artifacts artifacts/evaluation \
  --stage all
```

Detail per unit (termasuk referensi, skor, dan hasil aktual referensi) disimpan
di `data/evaluation/validation-per-unit.jsonl` dan
`data/evaluation/test-per-unit.jsonl`. Laporan ringkas tidak memuat narasi.

Data validasi yang terlalu kecil (kurang dari 100 unit atau 50 kelompok, atau
semua kandidat mengestimasi kurang dari 50 unit) membuat tuning ditunda dan test
tetap terkunci. Kode keluar yang dapat diperiksa agent:

| Kode | Arti |
| --- | --- |
| `0` | Tahap selesai. |
| `1` | Kesalahan tak terduga. |
| `2` | Input tidak valid (misalnya `--source` tidak ditemukan). |
| `3` | Data tidak cukup; tuning ditunda atau split kosong. |
| `4` | Manifest/konfigurasi terkunci tidak ada atau tidak cocok; jalankan ulang `prepare`/`validate`. |

Kegagalan input/konfigurasi juga ditulis sebagai JSON di stderr dengan `code`
dan `exitCode`.

Alur Docker dapat diuji tanpa snapshot Indo-Law memakai fixture sintetis yang
sudah dikomit:

```bash
docker compose --profile tools run --rm evaluate-fixture
```

Fixture memakai workspace `data/evaluation-fixture` dan artefak
`artifacts/evaluation-fixture`, dengan ambang minimum yang diperkecil agar alur
lengkap dapat berjalan pada 90 unit sintetis. Angka fixture bukan hasil
evaluasi Indo-Law dan tidak boleh dilaporkan sebagai hasil tugas kuliah.

Batas isolasi:

- Sumber mentah dipasang read-only; impor besar hanya saat aplikasi berhenti.
- Evaluasi tidak memasang volume database aplikasi dan memakai
  `data/evaluation/evaluation.db` sendiri.
- Sumber mentah dipasang read-only pada layanan impor dan evaluasi.
- Artefak impor/evaluasi ditulis ke `artifacts/`, bukan ke volume aplikasi.
- Pengambilan dataset bukan bagian dari build image.

Pemeriksaan isolasi mount (aplikasi harus sedang berjalan):

```bash
docker compose up -d --build
node scripts/verify-mount-isolation.mjs
```

Skrip menjalankan alur evaluasi pada fixture, membandingkan hash `/data/app.db`
sebelum/sesudah, dan memastikan `/data/app.db` tidak ada di container evaluasi.

### Fungsi pembagian dan metrik evaluasi

`tools/cli/src/evaluation/` memuat implementasi yang dipakai perintah
`evaluate`:

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
- `buildEvaluationCandidates()` menghasilkan grid 32 kombinasi, sedangkan
  `selectValidationCandidate` menerapkan aturan pemilihan dan seri. Keduanya
  hanya menerima data validasi; target test tidak pernah dipakai untuk memilih.
- `pipeline.ts` menyatukan impor, split, validasi, kunci, dan test, termasuk
  fingerprint manifest/prediksi untuk pemeriksaan reproduksibilitas.

Perintah pengujian:

```bash
npm run test:evaluation
```

## Pengembangan tanpa Docker

```bash
npm ci
npm run build          # paket bersama, API, dan frontend
npm test               # unit test data layer, CLI, importer, dan isolasi paket CBR

# API + frontend hasil build pada http://localhost:3000
DATABASE_PATH=./data/app.db WEB_DIST_DIR=./apps/web/dist npm start

# Opsional: konfigurasi retrieval selain config/retrieval.json
# RETRIEVAL_CONFIG_PATH=./config/retrieval.json npm start

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
packages/cbr    Mesin Retrieve–Reuse: model, kontrak, TF-IDF, atribut, indeks, reuse
packages/data   Akses SQLite, migrasi, repository, adapter snapshot CBR
tools/importer  Akuisisi snapshot, parsing XML, ekstraksi, normalisasi, laporan impor
tools/cli       Migrasi, status, create-case, impor, benchmark, pipeline evaluasi
docker/         Entrypoint image
scripts/        Pemeriksaan operasional dan generator fixture evaluasi
fixtures/       Snapshot Indo-Law sintetis untuk alur Docker evaluasi
```

Batas tanggung jawab: API, impor, evaluasi, dan benchmark memakai implementasi
bersama. Mesin CBR menerima fakta, konfigurasi, dan snapshot dari pemanggil
tanpa bergantung pada browser atau NestJS. Indeks TF-IDF adalah turunan basis
kasus: setiap perubahan unit/atribut/pasal/konfigurasi menaikkan generasi basis
kasus sehingga indeks lama tidak boleh dipakai. Selama rebuild, indeks lama
dilepas; bila build gagal, estimasi ditahan, bukan diisi dengan hasil basi.

## Pemeriksaan

1. `npm ci && npm run typecheck && npm test && npm run build`
2. `docker compose up --build`, lalu buka `http://localhost:3000` dan
   `http://localhost:3000/api/health`. Ringkasan harus menampilkan fingerprint
   konfigurasi, sumber `config/retrieval.json`, dan status indeks.
3. Migrasi database kosong: hapus volume **hanya untuk pemeriksaan** dengan
   `docker compose down -v`, lalu `docker compose up --build`; status skema
   harus `002`.
4. Alur 4R: tambahkan 2–3 unit sintetis melalui UI, jalankan Retrieve, dan
   periksa referensi, skor, perhitungan, serta rentang hasil aktual. Uji narasi
   kosong (ditolak) dan kategori tanpa kasus (estimasi ditahan dengan alasan).
   Untuk Revise/Retain, gunakan data sintetis atau salinan basis kasus—bukan
   unit dari split evaluasi. Hasil aktual harus berasal dari putusan, bukan dari
   estimasi.
5. CRUD dan indeks: ubah lalu hapus satu unit, jalankan estimasi berikutnya,
   dan pastikan indeks dibangun ulang serta unit yang dihapus tidak lagi menjadi
   referensi. Status indeks tidak boleh tetap `siap` setelah mutasi.
6. Persistensi: tambahkan unit kasus sintetis, lalu
   `docker compose up -d --force-recreate`; jumlah unit dan hasil aktual harus
   tetap.
7. Impor: jalankan `source:acquire`, hentikan aplikasi, jalankan layanan
   `import`, lalu periksa `artifacts/import/import-report.json`. Jalankan ulang
   impor dan pastikan jumlah unit tidak bertambah dua kali.
8. Benchmark: jalankan perintah `benchmark` pada database hasil impor dan
   pastikan laporan memisahkan fase startup/rebuild dari latensi pencarian.
9. Evaluasi pada fixture: buat folder `data/evaluation-fixture` dan
   `artifacts/evaluation-fixture`, lalu jalankan
   `docker compose --profile tools run --rm --build evaluate-fixture`. Pastikan
   `evaluation-manifest.json`, `split-manifest.json`, `validation-report.json`,
   `locked-config.json`, dan `test-report.json` terbentuk. Jalankan ulang
   layanan yang sama; fingerprint prediksi di `test-report.json` harus sama.
10. Isolasi mount: jalankan `node scripts/verify-mount-isolation.mjs` dan
    pastikan hash database aplikasi tidak berubah.
