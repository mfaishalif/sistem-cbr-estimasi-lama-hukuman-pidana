# Impor dan normalisasi basis kasus Indo-Law

Dokumen ini mencatat pelaksanaan impor untuk [Bangun impor dan normalisasi basis kasus Indo-Law](https://github.com/mfaishalif/sistem-cbr-estimasi-lama-hukuman-pidana/issues/15). Impor menghasilkan basis kasus lokal dan laporan kelolosan; dokumen ini bukan audit validitas korpus atau verifikasi PDF.

## Sumber dan snapshot

| Identitas | Nilai |
| --- | --- |
| Repositori | `ir-nlp-csui/indo-law` |
| Commit | `67340338adbc63021630947d905627eef0d7e43f` |
| Tree dataset | `14db967106b2d10c968d73d7b061774b81f508c8` |
| URL arsip | `https://github.com/ir-nlp-csui/indo-law/archive/67340338adbc63021630947d905627eef0d7e43f.zip` |
| SHA-256 arsip | `d033322c4086bfc3d688a8fef4f79a2dd912789a3db95874876d4f169847d124` |
| Berkas XML | 22.630 |
| Ukuran XML | 1.230.556.735 byte |

Arsip diunduh baru dari URL resmi, diekstrak, lalu setiap XML di-hash. `manifest.json` menyimpan commit, tree, SHA-256 arsip, SHA-256 tiap berkas, ukuran, dan waktu unduh. Akuisisi memverifikasi SHA-256 arsip dan jumlah XML terhadap nilai yang dipatok; arsip atau manifest yang tidak cocok ditolak. Dataset mentah tetap di penyimpanan lokal di luar repo dan tidak disalin ke artefak publik.

Perintah akuisisi:

```bash
npm run build:packages
npm run source:acquire -- --destination data/raw/indo-law
```

Gunakan `--archive <path>` untuk memakai ZIP yang sudah ada dan `--force` untuk mengulang ekstraksi. Prasyarat ekstraksi: `tar` pada Windows atau `unzip` pada Linux/macOS.

## Aturan ekstraksi

1. **Cakupan.** Hanya `klasifikasi="pidana-umum"`. `pidana-khusus`, status yang bukan berkekuatan hukum tetap, dan dakwaan yang jelas memakai hukum pidana khusus dilewati. Label `sub_klasifikasi` tidak otomatis dipercaya: kategori yang bertentangan dengan pasal dakwaan dikosongkan, bukan ditebak.
2. **Unit terdakwa–perkara.** Satu unit hanya dibuat jika identitas terdakwa dan satu hasil dapat dipisahkan. Dokumen dengan beberapa terdakwa bernomor (`terdakwa i`/`terdakwa ii`) atau beberapa hukuman per terdakwa dilewati; hasil tingkat dokumen tidak disalin ke semua terdakwa.
3. **Identitas.** Pengadilan dan nomor perkara dinormalisasi dari `lembaga_peradilan` dan kepala putusan, termasuk bentuk tanpa tanda baca seperti `nomor 392 pid b 2011 pn b`. Nama terdakwa tidak menjadi kunci pencocokan atau fitur.
4. **Hasil aktual.** Target hanya pidana penjara berjangka positif. `lama_hukuman` adalah label utama; ekspresi durasi pada `amar_putusan`, `fakta`, atau `pertimbangan_hukum` dipakai untuk memeriksa kecocokan. Konflik metadata versus teks dilewati. Normalisasi: 1 tahun = 360 hari, 1 bulan = 30 hari, hari ditambahkan apa adanya. Masa tahanan tidak dikurangkan dan pidana pengganti denda tidak ditambahkan.
5. **Narasi aman.** Kandidat utama `riwayat_dakwaan`, lalu `fakta`. Teks dipotong pada penanda pascaputusan (tuntutan, replik/duplik, pembelaan, pertimbangan hakim, amar, durasi hukuman, dsb.). Narasi yang masih memuat durasi hasil, kata "terbukti", tuntutan, atau penilaian hakim dilewati. Nama terdakwa, nomor perkara, pengadilan, dan URL diredaksi.
6. **Pasal dakwaan.** Pasal diambil dari `riwayat_dakwaan` beserta undang-undang/ayat dan susunan primair/alternatif/subsidair. Pasal yang akhirnya terbukti tidak dipaksakan; pasal alternatif tidak dihapus.
7. **Atribut opsional.** Hanya nilai yang jelas: usia dengan tanggal acuan penangkapan/penahanan, jenis kelamin, pekerjaan, pendidikan, riwayat penghukuman eksplisit (`yes`/`no`), kerugian yang benar-benar disebut sebagai kerugian, dan jumlah korban eksplisit. Nilai tidak diketahui tidak ditulis; bukan nol, bukan "tidak ada".
8. **Salinan dan kelompok.** Berkas byte-identik atau identik setelah normalisasi format berbagi satu dokumen kanonis dengan semua path/ID/URL sebagai alias. Unit dari pengadilan + nomor perkara yang sama masuk satu kelompok. Rujukan nomor perkara lain yang eksplisit pada bagian prosedural dapat menggabungkan kelompok; kemiripan nama atau kategori tidak dipakai.
9. **Determinisme.** Urutan berkas, ID dokumen/kelompok/unit, dan keputusan konflik deterministik. Impor ulang mengganti basis kasus secara atomik dan mempertahankan konfigurasi aplikasi.

## Hasil snapshot penuh

Dijalankan pada 18 November 2026 dengan Node.js 24.20.0 di host Windows lokal. Angka waktu adalah pengukuran satu mesin, bukan benchmark.

| Hasil | Jumlah |
| --- | ---: |
| XML dibaca/diparse | 22.630 / 22.630 |
| Dokumen sumber kanonis | 22.594 |
| Alias sumber | 67.890 |
| Unit kasus diterima | 5.782 |
| Kelompok perkara | 5.773 |
| Unit dilewati | 16.832 |
| Konflik hasil duplikat | 0 |

### Alasan dilewati

| Alasan | Jumlah |
| --- | ---: |
| `not_general_criminal_case` | 10.861 |
| `narrative_contains_outcome` | 1.588 |
| `multiple_defendants` | 1.316 |
| `special_law_charge` | 960 |
| `defendant_identity_missing` | 808 |
| `case_number_missing` | 419 |
| `outcome_not_positive` | 365 |
| `narrative_too_short` | 291 |
| `outcome_conflict` | 209 |
| `narrative_not_separable` | 15 |

### Kategori yang benar-benar lolos

| Kategori | Unit |
| --- | ---: |
| pencurian | 1.639 |
| penggelapan | 886 |
| penipuan | 811 |
| penganiayaan | 221 |
| pembunuhan | 192 |
| penghinaan | 154 |
| penadahan | 138 |
| kejahatan-terhadap-keamanan-negara | 128 |
| pemalsuan | 100 |
| pemerasan-dan-pengancaman | 39 |
| kealfaan-mengakibatkan-kematianluka | 37 |
| kejahatan-terhadap-kesusilaan | 32 |
| perjudian | 17 |
| kejahatan-terhadap-keteriban-umum | 14 |
| perusakan | 13 |
| lalu-lintas | 9 |
| mata-uang | 6 |
| senjata-api | 5 |
| kehutanan | 4 |
| kejahatan-terhadap-kemerdekaan-orang-lain | 2 |

Kategori kosong: 1.335 unit. Sebagian besar berlabel `tidak-diketahui` atau kategori yang tidak dapat dipertahankan terhadap pasal dakwaan. Kategori kosong bukan kategori "lain" dan tidak diisi dengan tebakan.

### Kelengkapan atribut

| Atribut | Terisi | Unit |
| --- | ---: | ---: |
| `age_years` + `age_reference_date` | 907 | 5.782 |
| `gender` | 3.306 | 5.782 |
| `occupation` | 4.240 | 5.782 |
| `education` | 1.124 | 5.782 |
| `prior_conviction` | 1.112 | 5.782 |
| `loss_amount_idr` | 1.085 | 5.782 |
| `victim_count` | 1 | 5.782 |
| `role` | 26 | 5.782 |
| `victim_harm` | 398 | 5.782 |
| `weapon_or_mode` | 1.783 | 5.782 |

`role`, `victim_harm`, dan `weapon_or_mode` hanya diisi dari frasa eksplisit pada narasi aman (misalnya "sebagai pelaku", "luka berat", "senjata tajam"). Nilai kosong berarti tidak ditemukan frasa yang jelas, bukan "tidak ada dalam data".

### Hasil aktual dan narasi

- 5.174 unit punya `lama_hukuman` yang cocok dengan ekspresi durasi pada teks putusan.
- 608 unit memakai metadata `lama_hukuman` saja karena ekspresi durasi tidak dapat diparse dengan aman.
- 5.401 unit memakai narasi dari `riwayat_dakwaan`; 381 dari `fakta` setelah penyaringan penanda pascaputusan.
- Pemeriksaan narasi tersimpan tidak menemukan `pidana penjara`, `menjatuhkan pidana`, `terbukti`, `tuntutan`, `menuntut`, `majelis hakim`, `replik`, atau `pembelaan`. Kemunculan `duplikat` adalah fakta perkara (kunci duplikat), bukan penanda duplik/replik.

### Pasal dakwaan

- 5.140 dari 5.782 unit memiliki minimal satu pasal dakwaan yang dapat dipetakan.
- 10.493 pasal primer, 173 alternatif, dan 69 subsidair dipertahankan sebagai susunan dakwaan; tidak ada pemaksaan ke pasal yang terbukti.

### Salinan dan kelompok

- 36 berkas digabung sebagai salinan byte/format identik; semua path, ID XML, dan URL tetap tersimpan sebagai alias.
- 5.773 kelompok untuk 5.782 unit; sembilan kelompok berisi lebih dari satu unit, termasuk tujuh penggabungan karena rujukan perkara terkait.
- Tujuh rujukan perkara terkait yang eksplisit terdeteksi dan digabungkan. Ini bukan bukti seluruh hubungan tersembunyi tidak ada; pola hanya menerima nomor perkara yang eksplisit pada bagian prosedural.

### Waktu dan ukuran

| Tahap | Waktu |
| --- | ---: |
| Penemuan snapshot dan manifest | 120 ms |
| Parsing XML | 28.280 ms |
| Ekstraksi dan validasi | 34.774 ms |
| Penulisan SQLite | 12.312 ms |
| Total | 81.456 ms |

## Mengulang dan memeriksa

```bash
# Akuisisi (sekali; dataset lokal, bukan bagian repo/image)
npm run build:packages
npm run source:acquire -- --destination data/raw/indo-law

# Hentikan aplikasi sebelum impor besar
docker compose stop app
docker compose --profile tools run --rm import

# Laporan: artifacts/import/import-report.json
# Database aplikasi: volume app-data, /data/app.db
```

Tanpa Docker:

```bash
node tools/cli/dist/index.js import \
  --source data/raw/indo-law \
  --database data/app.db \
  --report artifacts/import/import-report.json
```

Untuk pemeriksaan cepat, tambahkan `--limit <n>`. Impor bersifat replace: unit dari impor sebelumnya dihapus, konfigurasi aplikasi dipertahankan. Jangan menjalankan impor bersamaan dengan aplikasi yang menulis database.

## Pemeriksaan otomatis

`npm test` menjalankan 67 pemeriksaan, termasuk:

- pasangan terdakwa–hasil dan dokumen banyak terdakwa;
- normalisasi tahun/bulan/hari, tanpa pengurangan tahanan atau penambahan denda;
- metadata hasil yang bertentangan dengan teks putusan;
- narasi yang masih memuat durasi/tuntutan/penilaian hakim;
- pasal alternatif/subsidair dan hukum pidana khusus;
- atribut tidak diketahui versus eksplisit `no`;
- salinan byte/format, konflik hasil, kelompok perkara terkait;
- determinisme ID dan impor ulang;
- manifest hash valid dan hash yang tidak cocok.

## Batas

- Ini validasi impor, bukan audit validitas korpus, verifikasi PDF, atau klaim bahwa seluruh perkara pidana umum sudah terwakili.
- Ekstraksi memakai heuristik konservatif; 16.832 unit/dokumen dilewati dan alasannya dilaporkan. Jumlah yang lolos tidak boleh dinaikkan dengan melonggarkan aturan secara diam-diam.
- Pemisahan otomatis banyak terdakwa belum dilakukan; dokumen tersebut dilewati sesuai keputusan cakupan.
- Kategori kosong dan atribut yang belum diekstrak tetap dilaporkan sebagai keterbatasan.
- Angka akurasi, konfigurasi evaluasi, mesin Retrieve–Reuse, dan antarmuka 4R belum termasuk pekerjaan ini.
