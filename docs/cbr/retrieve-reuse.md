# Mesin Retrieve–Reuse dan Siklus Indeks

Status: mesin bersama sudah diimplementasikan dan diuji; integrasi API/UI,
pipeline evaluasi terkunci, serta penetapan bobot/ambang akhir belum menjadi
bagian dokumen ini. Angka pada bagian benchmark adalah pengukuran kecepatan,
bukan bukti akurasi estimasi.

## Batas dan titik masuk

Mesin berada di `packages/cbr` dan tidak bergantung pada HTTP, NestJS, browser,
maupun SQLite. Batas datanya adalah `CaseBaseSnapshotSource`; adapter SQLite ada
di `packages/data/src/cbr-source.ts`.

| Kebutuhan | Titik masuk |
| --- | --- |
| Membangun indeks dari kasus referensi | `buildRetrievalIndex(cases, config, options)` |
| Mengestimasi dengan indeks siap | `estimateWithIndex(index, request)` |
| Menjaga indeks tetap cocok dengan sumber | `CaseBaseIndexManager` |
| Membaca snapshot SQLite | `SqliteCaseBaseSource`, `loadCaseBaseSnapshot` |
| Menyimpan/membaca konfigurasi | `saveRetrievalConfig`, `loadRetrievalConfig` |
| Mengukur kecepatan | `cbr benchmark` (`tools/cli/src/benchmark.ts`) |

Permintaan estimasi hanya membawa fakta pra-putusan:

```ts
interface EstimateRequest {
  facts: CaseFacts;
  excludeCaseUnitIds?: readonly string[];
}
```

Hasil aktual tidak pernah masuk ke `facts`. Kasus yang sedang diestimasi dapat
dikecualikan agar tidak menjadi referensi bagi dirinya sendiri.

## Prapemrosesan narasi dan TF-IDF

1. Narasi dinormalisasi: NFKD, diakritik dihapus, huruf kecil, setiap deret
   non-huruf/non-angka menjadi spasi. Angka dipertahankan.
2. Token dipotong berdasarkan `minTokenLength` dan daftar `stopwords`.
3. Kosakata dan IDF **hanya** di-fit dari narasi kasus referensi/training.
4. TF-IDF memakai TF sublinear `1 + ln(count)` dan IDF halus
   `ln((N + 1) / (df + 1)) + 1` secara default.
5. Kemiripan narasi adalah cosine. Dokumen tidak disimpan sebagai vektor padat:
   indeks menyimpan posting terbalik (`Int32Array` untuk indeks kasus,
   `Float64Array` untuk bobot) dan satu norma per dokumen. Waktu kueri hanya
   menyentuh istilah yang ada pada kueri.

Istilah narasi yang tidak dikenali kosakata training tidak mendapat bobot. Jika
tidak ada satu pun istilah yang dikenali, hasil ditahan dengan
`NARASI_TIDAK_TERBANDING`; atribut tidak dipakai sebagai pengganti narasi.

## Atribut opsional, bobot, dan coverage

Atribut hanya dibandingkan bila diketahui di kedua sisi. Nilai yang tidak ada
tidak diperlakukan sebagai nol, "tidak ada", atau kecocokan sempurna.

- `categorical`: sama persis = 1, berbeda = 0.
- `set`: Jaccard atas himpunan nilai.
- `number-range`: `1 - |a - b| / (max - min)` pada skala hasil fit training.
- `number-log-range`: sama seperti rentang, tetapi memakai `ln(1 + nilai)`.
- `age_years` hanya dibandingkan bila kedua kasus memiliki
  `age_reference_date` yang selisihnya tidak melebihi batas konfigurasi.
- Pasal dakwaan dibandingkan sebagai Jaccard referensi ternormalisasi.

Bobot komponen yang tersedia di kedua sisi dinormalisasi ulang:

```text
skor = Σ(bobot × kemiripan) / Σ(bobot yang tersedia)
```

`coverage` = bobot opsional yang benar-benar dibandingkan / bobot opsional yang
diketahui pada sisi kueri. Atribut yang tidak diketahui kueri tidak dihitung
sebagai kekurangan kandidat. Atribut yang diketahui kueri tetapi tidak ada pada
kandidat, atau tidak aman dibandingkan, menurunkan coverage dan dilaporkan.
Pasal dakwaan mengikuti aturan yang sama: bila kueri memuat pasal tetapi
kandidat tidak memilikinya, bobot pasal menurunkan coverage dan daftar pasal
yang tidak dapat dibandingkan dilaporkan.

Setiap komponen hasil memuat `weight`, `normalizedWeight`, `similarity`,
`contribution`, dan detail perbandingan. Dengan demikian perhitungan dapat
diaudit tanpa membuka UI.

## Kategori, batas, dan determinisme

- `categoryRestriction: 'when-known'` (default) membatasi pencarian ke kategori
  yang sama hanya bila kueri menyatakan kategori. Kategori yang tidak diketahui
  mencari seluruh kandidat. `'never'` selalu mencari seluruh kandidat.
- Kandidat harus memiliki narasi tidak kosong dan hasil aktual positif.
- `minScore` harus dilewati secara ketat; `minAttributeCoverage` menyaring
  kandidat dengan coverage terlalu rendah.
- `maxReferences` memotong hasil, `minReferences` menentukan kapan estimasi
  ditahan dengan `REFERENSI_TIDAK_CUKUP`.
- Urutan ditentukan oleh skor menurun, lalu ID unit kasus menaik. Hasil aktual
  tidak pernah menjadi tie-break.
- Kandidat yang sama tidak boleh muncul dua kali; referensi memakai ID unit
  kasus yang unik.

## Reuse

Estimasi adalah rata-rata hasil aktual berbobot skor:

```text
estimasi = Σ(skor × actualSentenceDays) / Σ(skor)
```

Hari bulat memakai aturan `nearest-day-half-up`; `rawDays`, `numerator`, dan
`denominator` tetap dilaporkan. Tidak ada pengurangan masa tahanan, substitusi
denda, atau aturan tambah/kurang manual. Bila jumlah bobot nol, hasil ditahan
dengan `BOBOT_NOL`, bukan diisi angka sembarang.

## Kontrak keluaran

`EstimateResult` selalu berisi:

- `status`: `estimated` atau `withheld`;
- `caseBaseGeneration` dan `configFingerprint`;
- kategori yang diminta dan batas pencarian yang dipakai;
- ringkasan kueri: jumlah token, istilah dikenali, norma, kategori, pasal, dan
  atribut yang diketahui/tidak diketahui;
- `estimate.days`, `rawDays`, `numerator`, `denominator`, dan aturan pembulatan;
- `withholding` berisi kode dan pesan bila ditahan;
- daftar referensi: peringkat, ID, skor, hasil aktual, komponen skor, coverage,
  atribut/pasal yang hilang atau tidak sebanding, fakta, dan sumber;
- ringkasan kandidat dan parameter skor yang dipakai.

Kode penahanan: `NARASI_KOSONG`, `NARASI_TIDAK_TERBANDING`,
`BASIS_KASUS_KOSONG`, `TIDAK_ADA_REFERENSI_KATEGORI`, `REFERENSI_TIDAK_CUKUP`,
`BOBOT_NOL`, `INDEKS_BELUM_SIAP`, dan `INDEKS_GAGAL_DIBANGUN`.

## Siklus hidup indeks

`CaseBaseIndexManager` memegang indeks turunan; SQLite tetap menjadi sumber
kebenaran untuk kasus, hasil aktual, dan konfigurasi.

1. Sebelum membangun, manager mencatat generasi basis kasus dan fingerprint
   konfigurasi.
2. Setelah pembangunan, keduanya dibaca ulang. Bila berubah, hasil dibuang dan
   pembangunan diulang; indeks lama tidak dipublikasikan.
3. Bila pembangunan gagal, tidak ada fallback ke indeks lama. Estimasi ditahan
   dengan `INDEKS_GAGAL_DIBANGUN`.
4. Selama rebuild, indeks lama juga dilepas agar tidak melayani data basi.
5. `setConfig` dan `invalidate` menaikkan epoch sehingga rebuild yang sedang
   berjalan tidak dapat mempublikasikan hasil yang sudah tidak cocok.
6. Penambahan, perubahan hasil aktual, penghapusan unit, perubahan
   atribut/pasal, atau perubahan konfigurasi menaikkan generasi. Kasus yang
   dihapus tidak lagi menjadi referensi; hasil aktual baru dipakai setelah
   indeks yang cocok siap.
7. Bila sumber menyediakan `loadConfig` (adapter SQLite menyediakannya),
   konfigurasi tersimpan dibaca ulang pada awal setiap rebuild. Perubahan
   konfigurasi yang menaikkan generasi tidak dapat dipasangkan dengan indeks
   yang masih memakai konfigurasi lama.

Indeks dapat dibangun ulang kapan saja dari snapshot. Tidak ada indeks persisten
yang dapat menyajikan data basi setelah restart.

## Pemisahan data training

- Kosakata, IDF, dan skala numerik di-fit dari kasus referensi yang diberikan
  ke `buildRetrievalIndex`.
- Pemanggil evaluasi wajib memberikan kasus training saja saat membangun
  indeks. Fakta validasi/test tidak boleh masuk ke snapshot pembangunan indeks.
- `EstimateRequest` tidak membawa hasil aktual, sehingga hasil kueri tidak dapat
  memengaruhi skor.
- Unit yang hasil aktualnya tidak diketahui atau tidak positif tidak masuk
  indeks dan dilaporkan sebagai `excludedCaseCount`.

## Konfigurasi default

`DEFAULT_RETRIEVAL_CONFIG` adalah nilai placeholder, bukan hasil tuning:

| Parameter | Nilai default |
| --- | --- |
| `narrativeWeight` | 1 |
| `articleWeight` | 0.5 |
| `maxReferences` | 5 |
| `minReferences` | 1 |
| `minScore` | 0 (kandidat harus > 0) |
| `minAttributeCoverage` | 0 |
| `categoryRestriction` | `when-known` |
| `minTokenLength` | 2 |
| `stopwords` | kosong |
| TF sublinear / IDF halus | aktif |

Bobot atribut default berkisar 0.1–0.2 per atribut. Semua parameter dapat
diinjeksi lewat `RetrievalConfig`; nilai akhir tetap menunggu tiket evaluasi
konfigurasi (#17). Jangan menganggap nilai ini tervalidasi secara empiris.

## Benchmark kecepatan

Perintah:

```bash
npm run build:packages
node tools/cli/dist/index.js benchmark \
  --database data/app.db \
  --queries 500 \
  --warmup 20 \
  --report artifacts/benchmark/retrieve-reuse.json
```

Benchmark memisahkan:

- pembukaan database, pembacaan konfigurasi, pembacaan snapshot, dan penutupan;
- pembangunan indeks;
- pencarian dengan indeks siap (pemanasan tidak diukur);
- snapshot RAM proses pada setiap fase.

### Data dan mesin pengukuran

| Hal | Nilai |
| --- | --- |
| Tanggal | 2026-11-18 |
| Mesin | Windows `10.0.26200`, x64 |
| CPU | Intel Core i7-10870H @ 2.20 GHz, 16 CPU logis |
| RAM total | 16.934.150.144 byte (sekitar 15,8 GiB) |
| Node.js | v24.20.0 |
| Snapshot | commit `67340338adbc63021630947d905627eef0d7e43f` |
| XML dibaca | 22.630 |
| Unit kasus | 5.782 (5.773 kelompok) |
| Kategori | 20 |
| Istilah indeks | 59.699 |
| Ukuran database | 85.151.744 byte (sekitar 81,2 MiB) |
| Generasi saat ukur | 31.406 |
| Fingerprint konfigurasi | `c992d8c713c46e73` |
| Kueri terukur | 500 kasus layak, disebar merata, kasus sendiri dikecualikan |
| Pemanasan | 20 pencarian |

### Waktu

| Fase | Waktu |
| --- | ---: |
| Buka database | 2,088 ms |
| Baca konfigurasi | 0,383 ms |
| Baca snapshot | 1.204,014 ms |
| Tutup database | 1,081 ms |
| Bangun indeks | 2.845,678 ms |
| Total startup/rebuild | 4.053,297 ms |

### RAM proses

| Titik | RSS |
| --- | ---: |
| Baseline setelah buka database | 57.094.144 byte (sekitar 54,4 MiB) |
| Setelah snapshot | 190.185.472 byte (sekitar 181,4 MiB) |
| Setelah indeks | 374.894.592 byte (sekitar 357,5 MiB) |
| Setelah pencarian | 822.595.584 byte (sekitar 784,5 MiB) |

Kenaikan RSS pembangunan indeks sekitar 184,7 MB; kenaikan selama 500 pencarian
sekitar 447,7 MB. Angka terakhir adalah snapshot proses tanpa pemaksaan garbage
collection, sehingga mencakup objek hasil sementara dan bukan batas memori
stabil. Nilai ini tidak boleh dipakai sebagai klaim kebutuhan RAM produksi tanpa
pengukuran tambahan.

### Distribusi latensi pencarian

| Metrik | Latensi |
| --- | ---: |
| Minimum | 1,772 ms |
| Rata-rata | 14,901 ms |
| p50 | 14,913 ms |
| p90 | 23,958 ms |
| p95 | 28,376 ms |
| p99 | 32,951 ms |
| Maksimum | 53,063 ms |
| Total 500 pencarian | 7.450,647 ms |

Target tiket adalah pencarian dengan indeks siap ≤ 2.000 ms. Pada konfigurasi
dan mesin di atas, latensi maksimum 53,063 ms dan p95 28,376 ms, sehingga target
terpenuhi untuk data yang diukur. Ini bukan klaim akurasi, bukan klaim performa
pada perangkat lain, dan bukan hasil tuning bobot/ambang. Seluruh 500 kueri
menghasilkan estimasi; tidak ada yang ditahan pada pengukuran ini.

Dua kali menjalankan benchmark pada kode akhir menunjukkan variasi wajar:
pembacaan snapshot 1.204–2.656 ms, pembangunan indeks 2.772–2.846 ms, p95
pencarian 25,6–28,4 ms, dan maksimum 49,4–53,1 ms. Angka pada tabel adalah run
terakhir; variasi ini alasan untuk tidak menganggap satu angka sebagai jaminan
performa perangkat lain.

## Cakupan pengujian

Tes mesin mencakup perhitungan berbobot, nilai kosong versus nol, istilah narasi
tak dikenal, coverage dan kategori, referensi tidak cukup, skor seri,
determinisme, pemisahan data training, serta konsistensi setelah
tambah/ubah/hapus/Retain dan perubahan rebuild. Tes adapter SQLite mencakup
snapshot, generasi, dan pemuatan konfigurasi. Tes benchmark mencakup ringkasan
persentil, pemisahan fase, laporan kosong, dan validasi argumen.

Jalankan:

```bash
npm test
npm run typecheck
```
