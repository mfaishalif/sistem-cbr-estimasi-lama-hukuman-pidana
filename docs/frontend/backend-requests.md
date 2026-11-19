# Permintaan frontend ke backend

Dokumen ini mencatat kontrak data yang dibutuhkan UI, keputusan yang sudah
diimplementasikan, dan angka hasil impor ulang snapshot Indo-Law. Semua angka
diukur pada basis kasus `data/backend-requests/app.db` hasil impor snapshot
`67340338` dan konfigurasi `config/retrieval.json` dengan fingerprint
`bd4fadb2b7402393`.

## Ringkasan status

| # | Permintaan | Status | Bukti |
| --- | --- | --- | --- |
| 1 | Selaraskan `config/retrieval.json` dengan konfigurasi evaluasi terkunci | Selesai | Fingerprint `bd4fadb2b7402393` |
| 2 | Normalisasi nilai `education` dan `occupation` saat impor | Selesai | 120 dan 184 nilai dibuang; 304→280 dan 764→741 nilai unik |
| 3 | `GET /api/cases`: filter `category=`, tanpa kategori, `narrationPreview` | Selesai | `q=tegal&category=pencurian` = 16; `category=__none__` = 1.335 |
| 4 | `GET /api/vocabulary` | Selesai | 20 kategori, 1.335 tanpa kategori, top-20 atribut |

Snapshot resmi diverifikasi ulang dengan alat yang ada:

- commit `67340338adbc63021630947d905627eef0d7e43f`
- arsip `indo-law-67340338adbc63021630947d905627eef0d7e43f.zip`
- SHA-256 arsip `d033322c4086bfc3d688a8fef4f79a2dd912789a3db95874876d4f169847d124`
- 22.630 berkas XML, 1.230.556.735 byte

Hasil impor: **5.782 unit perkara**, **5.773 kelompok perkara**, **1.335 unit
tanpa kategori**. Laporan impor mencatat generasi **31.102**; setelah API
menyimpan konfigurasi, generasi basis kasus menjadi **31.103**.

---

## 1. Konfigurasi retrieval

`config/retrieval.json` sekarang berisi konfigurasi `kandidat-15` yang dikunci
pada evaluasi:

| Parameter | Nilai |
| --- | --- |
| Bobot kronologi / pasal / kelompok atribut | 0,75 / 0,20 / 0,05 |
| `maxReferences` | 5 |
| `minReferences` | 2 |
| `minScore` | 0,10 |
| `minAttributeCoverage` | 0,85 |
| `minTokenLength` | 1 |
| `minDocumentFrequency` | 2 |
| `sublinearTermFrequency` | `false` |
| `smoothInverseDocumentFrequency` | `true` |

`GET /api/config` mengembalikan fingerprint `bd4fadb2b7402393`, sama dengan
fingerprint artefak evaluasi. Drawer "Cara kerja" hanya menyatakan konfigurasi
aplikasi sama dengan evaluasi bila fingerprint itu cocok; bila berbeda, ia
tetap menyebut bahwa hasil aplikasi dapat berbeda.

Catatan penting untuk UI: cakupan 98,62% dan MAE 371,7 hari adalah **hasil uji
historis sebelum normalisasi atribut**. Angka itu tidak dihitung ulang pada
basis kasus yang sudah dinormalisasi.

## 2. Normalisasi `education` dan `occupation`

Satu aturan dipakai oleh importer, penulisan lewat API, dan pembandingan nilai
lama:

- rapikan huruf besar/kecil, spasi, dan tanda baca di tepi;
- buang nilai kosong, hanya tanda hubung, `terdakwa`, dan penanda tidak
  diketahui (`tidak diketahui`, `n/a`, `null`, dan sejenisnya);
- petakan alias pendidikan ke `tidak-sekolah`, `sd`, `smp`, `sma`, `diploma`,
  `sarjana`, atau `pascasarjana`;
- petakan `tani` → `petani` dan `karyawan swasta` → `swasta`;
- pertahankan nilai bermakna di luar alias, misalnya `sd tidak tamat`,
  `buruh harian`, dan `tidak bekerja`;
- lokasi bukti (`sourceLocation`) tetap tersimpan.

Normalisasi terjadi sebelum nilai ditulis, sehingga nilai yang dibuang tidak
membuat baris atribut. Perbandingan CBR memakai fungsi yang sama, jadi data
lama dan data baru bertemu pada bentuk kanonis yang sama.

### Hasil impor ulang

| Atribut | Tercatat sebelum | Tercatat sesudah | Nilai unik sebelum | Nilai unik sesudah | Dibuang |
| --- | ---: | ---: | ---: | ---: | ---: |
| `education` | 1.124 | 1.004 | 304 | 280 | 120 |
| `occupation` | 4.240 | 4.056 | 764 | 741 | 184 |

Nilai teratas sesudah normalisasi:

- `education`: `sma` 208, `sd` 146, `smp` 138, `sd tidak tamat` 34, `smk` 31,
  `stm` 22, `smp tidak tamat` 17, `sarjana` 14.
- `occupation`: `swasta` 1.290, `wiraswasta` 583, `buruh` 279, `petani` 221,
  `tidak bekerja` 68, `buruh harian lepas` 60, `sopir` 60.

Laporan impor (`artifacts/import/backend-requests.json`) memuat, untuk setiap
atribut, `present`, `total`, `uniqueValuesBefore`, `uniqueValuesAfter`, dan
`discarded`, dihitung pada unit perkara yang sudah dideduplikasi.

`role` (26 perkara) dan `victim_count` (1 perkara) tetap tersedia di UI, tetapi
keduanya diberi catatan singkat bahwa isian itu jarang tercatat di Indo-Law
dan hampir tidak memengaruhi kemiripan.

## 3. `GET /api/cases`

Parameter:

- `limit` (1–200, default 25), `offset` (≥0), `q` (pencarian teks).
- `category` dicocokkan **eksak** dan digabung dengan `q` memakai AND.
- `category=` kosong berarti semua kategori.
- `category=__none__` berarti `category IS NULL`.

`items` dan `total` memakai predikat yang sama, sehingga jumlah halaman tidak
berbeda dari daftar.

Contoh terukur:

```http
GET /api/cases?q=tegal&category=pencurian&limit=20&offset=0
```

mengembalikan `total: 16`. `GET /api/cases?category=__none__` mengembalikan
`total: 1335`.

Setiap `CaseUnitSummary` sekarang memiliki:

```ts
narrationPreview: string | null;
```

Nilainya adalah kronologi dengan spasi dirapikan, dipotong paling banyak 160
karakter **termasuk elipsis**, dan dipotong di batas kata bila memungkinkan.
Kronologi kosong menghasilkan `null`.

Frontend memakai parameter `q` dan `category` secara terpisah, mereset halaman
saat filter berubah, mengabaikan respons lama yang datang terlambat, dan
menampilkan **Tanpa kategori** beserta jumlah perkara di dropdown. Potongan
kronologi tampil di tabel desktop dan daftar ponsel.

## 4. `GET /api/vocabulary`

Respons aktual:

```json
{
  "generation": 31103,
  "categories": [
    { "value": "pencurian", "caseCount": 1639 },
    { "value": "penggelapan", "caseCount": 886 },
    { "value": "penipuan", "caseCount": 811 }
  ],
  "uncategorizedCount": 1335,
  "attributes": {
    "education": [{ "value": "sma", "caseCount": 208 }],
    "occupation": [{ "value": "swasta", "caseCount": 1290 }]
  },
  "limit": 20
}
```

- Kategori dikembalikan semua, diurutkan jumlah terbanyak lalu nilai naik.
- `education` dan `occupation` dibatasi maksimal 20 nilai; `limit` selalu 20.
- Seluruh respons dibaca dalam satu transaksi baca, sehingga `generation` dan
  hitungan berasal dari snapshot basis kasus yang sama.
- Slug dikirim apa adanya; label tampilan tetap diatur frontend.

Frontend memakai satu provider kosakata untuk Basis kasus, Estimasi, dan
editor. Provider mendengarkan perubahan generasi basis kasus dan memuat ulang
setelah penyimpanan, sehingga jumlah kategori ikut berubah tanpa reload.
Kategori di form Estimasi berupa pilihan dari API; editor menerima kategori
baru lewat input dengan saran. Pendidikan memakai pilihan kanonis, sedangkan
pekerjaan memakai saran top-20 yang tetap menerima nilai di luar daftar. Nilai
lama yang tidak ada di daftar tetap ditampilkan saat mengedit.

---

## Menjalankan basis kasus terpisah

Aplikasi Docker tetap memakai port `3000` dan basis kasusnya sendiri. Untuk
memeriksa snapshot resmi tanpa mengubah data Docker, jalankan instance kedua:

```powershell
npm run build
$env:PORT = '3001'
$env:DATABASE_PATH = 'data/backend-requests/app.db'
$env:WEB_DIST_DIR = 'apps/web/dist'
node apps/api/dist/main.js
```

Buka `http://localhost:3001`. Saat start, API memuat
`config/retrieval.json`, menyimpannya ke basis data bila fingerprint berubah,
lalu membangun indeks dari basis kasus tersebut.

Untuk uji tulis (tambah/ubah perkara), salin basis kasus resmi lebih dulu agar
snapshot tidak berubah:

```powershell
Copy-Item data/backend-requests/app.db $env:TEMP\cbr-write\app.db -Force
$env:PORT = '3002'
$env:DATABASE_PATH = "$env:TEMP\cbr-write\app.db"
node apps/api/dist/main.js
```

Impor ulang dari snapshot resmi:

```powershell
node tools/importer/dist/acquire-cli.js `
  --destination C:\Users\faishal\Documents\cbr-indo-law-snapshot\snapshot `
  --archive C:\Users\faishal\Documents\cbr-indo-law-snapshot\indo-law-67340338adbc63021630947d905627eef0d7e43f.zip

node tools/cli/dist/index.js import `
  --source C:\Users\faishal\Documents\cbr-indo-law-snapshot\snapshot `
  --database data/backend-requests/app.db `
  --report artifacts/import/backend-requests.json
```

## Verifikasi

- `npm test` — 254 tes lulus (baseline 238).
- `npm run lint` — tanpa peringatan.
- `npm run build` — paket, web, dan API berhasil dibangun.
- Pemeriksaan API pada port `3001`: 5.782 unit, 5.773 kelompok, 1.335 tanpa
  kategori, fingerprint `bd4fadb2b7402393`.
- Dengan hanya satu referensi yang lolos, estimasi ditahan dengan kode
  `REFERENSI_TIDAK_CUKUP`.
- Pemeriksaan Playwright: filter gabungan, paginasi, pratinjau desktop dan
  ponsel, pilihan form, penyegaran kosakata setelah simpan, dan catatan
  fingerprint di "Cara kerja".
