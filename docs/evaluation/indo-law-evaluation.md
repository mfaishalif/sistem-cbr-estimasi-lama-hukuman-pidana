# Hasil evaluasi Indo-Law

Laporan ini mencatat hasil protokol evaluasi yang disepakati pada
[rancangan evaluasi](https://github.com/mfaishalif/sistem-cbr-estimasi-lama-hukuman-pidana/issues/8#issuecomment-6962133092)
dan
[keputusan konfigurasi](https://github.com/mfaishalif/sistem-cbr-estimasi-lama-hukuman-pidana/issues/17#issuecomment-6968230111),
dijalankan untuk
[Jalankan evaluasi Indo-Law dan tulis hasil tugas kuliah](https://github.com/mfaishalif/sistem-cbr-estimasi-lama-hukuman-pidana/issues/26).
Angka di bawah adalah pola putusan historis pada snapshot yang dipakai, bukan
penentuan hukuman yang seharusnya dijatuhkan.

## Identitas eksperimen

| Identitas | Nilai |
| --- | --- |
| Kode aplikasi | commit `5ba24e3abe89922ba37edd088d194ca63e71cc0e` (merge PR #33); laporan ini hanya menambah dokumen |
| Image Docker | `sha256:97f552a191a1644f12e3301ee4517fd23fb602acf81fcf7613a143147f145c2a` |
| Repositori sumber | `ir-nlp-csui/indo-law` |
| Commit snapshot | `67340338adbc63021630947d905627eef0d7e43f` |
| Tree dataset | `14db967106b2d10c968d73d7b061774b81f508c8` |
| SHA-256 arsip | `d033322c4086bfc3d688a8fef4f79a2dd912789a3db95874876d4f169847d124` |
| Berkas XML | 22.630 berkas, 1.230.556.735 byte |
| Manifest snapshot terverifikasi | ya (22.630/22.630 berkas dibaca) |
| Seed split | `indo-law-cbr-v1` |
| Proporsi split | 0,70 / 0,15 / 0,15 |
| Fingerprint basis kasus | `630eb207ddee138e` |
| Fingerprint split | `f520de0d305a9dfd` |
| Fingerprint manifest | `9c03998ea7334dc3` |
| Fingerprint konfigurasi terkunci | `bd4fadb2b7402393` |
| Lingkungan | Docker Desktop 29.7.2, container Linux `linux/amd64`, Node.js 24.20.0, 16 CPU, 8.201.605.120 byte RAM |
| Waktu tahap prepare / validate / test | `2026-11-19T04:50:09Z` / `2026-11-19T05:00:00Z` / `2026-11-19T05:03:01Z` |

Dataset mentah, database evaluasi, manifest terperinci, dan detail per unit
disimpan di luar Git (`data/raw/indo-law`, `data/evaluation`, dan
`artifacts/evaluation`). Repo hanya memuat laporan agregat ini.

## Data dan pembagian

Impor menerima 5.782 unit dalam 5.773 kelompok perkara. Seluruh 5.782 unit
memiliki hasil aktual positif dan masuk perhitungan kelayakan. Pemeriksaan
pipeline menyatakan setiap unit tepat sekali pada satu split dan tidak ada
kelompok yang terpotong antar-split.

| Split | Unit | Kelompok | Unit dengan hasil aktual positif | Tanpa kategori |
| --- | ---: | ---: | ---: | ---: |
| Training | 4.048 | 4.040 | 4.048 | 924 |
| Validasi | 867 | 867 | 867 | 217 |
| Test | 867 | 866 | 867 | 194 |
| **Total** | **5.782** | **5.773** | **5.782** | **1.335** |

### Ukuran kategori per split

| Kategori | Training | Validasi | Test | Total |
| --- | ---: | ---: | ---: | ---: |
| kealfaan-mengakibatkan-kematianluka | 28 | 2 | 7 | 37 |
| kehutanan | 3 | 0 | 1 | 4 |
| kejahatan-terhadap-keamanan-negara | 95 | 17 | 16 | 128 |
| kejahatan-terhadap-kemerdekaan-orang-lain | 2 | 0 | 0 | 2 |
| kejahatan-terhadap-kesusilaan | 20 | 8 | 4 | 32 |
| kejahatan-terhadap-keteriban-umum | 6 | 5 | 3 | 14 |
| lalu-lintas | 9 | 0 | 0 | 9 |
| mata-uang | 5 | 0 | 1 | 6 |
| pemalsuan | 73 | 9 | 18 | 100 |
| pembunuhan | 145 | 25 | 22 | 192 |
| pemerasan-dan-pengancaman | 26 | 3 | 10 | 39 |
| penadahan | 103 | 18 | 17 | 138 |
| pencurian | 1.148 | 242 | 249 | 1.639 |
| penganiayaan | 149 | 34 | 38 | 221 |
| penggelapan | 628 | 123 | 135 | 886 |
| penghinaan | 101 | 31 | 22 | 154 |
| penipuan | 555 | 131 | 125 | 811 |
| perjudian | 16 | 1 | 0 | 17 |
| perusakan | 10 | 1 | 2 | 13 |
| senjata-api | 2 | 0 | 3 | 5 |
| (tanpa kategori) | 924 | 217 | 194 | 1.335 |
| **Total** | **4.048** | **867** | **867** | **5.782** |

Kategori kosong bukan kategori "lain". Unit tanpa kategori memakai median
training keseluruhan sebagai pembanding, sesuai keputusan evaluasi.

## Protokol yang dijalankan

Tahap dijalankan terpisah agar konfigurasi dikunci dari validasi sebelum hasil
test dibaca:

```bash
docker compose --profile tools build evaluate

docker compose --profile tools run --rm evaluate evaluate \
  --workspace /workspace --artifacts /artifacts \
  --source /sources/indo-law --stage prepare

docker compose --profile tools run --rm evaluate evaluate \
  --workspace /workspace --artifacts /artifacts --stage validate

docker compose --profile tools run --rm evaluate evaluate \
  --workspace /workspace --artifacts /artifacts --stage test
```

Jalur yang benar-benar dipakai pada mesin ini menjalankan container detached
(`docker compose ... run -d --name cbr-eval-prepare evaluate evaluate ...`) agar
proses tidak bergantung pada sesi terminal, lalu status container diperiksa
sampai selesai. Perintah evaluasinya sama dengan tiga perintah di atas.

- **Training** menjadi satu-satunya sumber basis kasus, kosakata, IDF, skala
  numerik, dan median pembanding.
- **Validasi** menjalankan 32 kandidat grid. Target cakupan 90%; di antara
  kandidat yang memenuhi target dipilih MAE terendah, lalu cakupan tertinggi,
  lalu urutan grid. Test tidak dibaca pada tahap ini.
- **Test** hanya berjalan setelah `locked-config.json` terbentuk dan cocok
  dengan fingerprint manifest, snapshot, dan protokol. Hasil test tidak dipakai
  untuk memilih ulang konfigurasi.
- Tiga model dinilai pada test yang sama: input gabungan dengan Reuse berbobot
  (konfigurasi terkunci), narasi saja dengan bobot 1/0/0, dan input gabungan
  dengan agregasi aritmetika tanpa bobot.

## Hasil validasi dan konfigurasi terkunci

Dari 32 kandidat, semuanya mencapai cakupan validasi di atas 90%. Kandidat
terpilih adalah `kandidat-15` (indeks grid 15):

| Parameter | Nilai |
| --- | --- |
| Bobot narasi / pasal / atribut | 0,75 / 0,20 / 0,05 |
| Jumlah referensi maksimum (`k`) | 5 |
| Minimum referensi | 2 |
| Skor minimum | 0,10 |
| Cakupan atribut minimum | 0,85 |
| Cakupan validasi | 97,69% (847/867) |
| MAE validasi | 418,86 hari |
| RMSE validasi | 702,69 hari |
| MedAE validasi | 269,91 hari |
| Baseline MAE pada unit yang sama | 449,25 hari |
| Baseline MAE seluruh unit layak | 449,55 hari |

Kandidat dengan cakupan 99,88% (misalnya `kandidat-09`, 866/867) tidak dipilih
karena aturan mengutamakan MAE terendah setelah target cakupan terpenuhi; MAE
kandidat itu 426,54 hari, lebih tinggi daripada 418,86 hari. Kunci dibuat pada
`2026-11-19T05:00:00Z`, sebelum test dijalankan pada `2026-11-19T05:03:01Z`.

## Hasil test

Test berisi 867 unit layak, 866 kelompok, dan 194 unit tanpa kategori. Evaluasi
membandingkan CBR dengan dua model sederhana. Median training keseluruhan
memberikan prediksi 660 hari untuk setiap unit. Median per kategori memakai
660 hari sebagai cadangan ketika median kategori tidak tersedia.

### Ringkasan model

| Model | Cakupan | Diestimasi | Ditahan | MAE CBR | RMSE CBR | MedAE CBR | MAE baseline | RMSE baseline | MedAE baseline |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gabungan berbobot | 98,62% | 855/867 | 12 | **371,7** | **660,8** | **223,1** | 393,9 | 746,8 | 240,0 |
| Narasi berbobot | **99,54%** | 863/867 | 4 | 405,1 | 688,1 | 245,5 | 394,3 | 744,9 | 240,0 |
| Gabungan tanpa bobot | 98,62% | 855/867 | 12 | 377,2 | 669,3 | 228,0 | 393,9 | 746,8 | 240,0 |

Kolom baseline pada tabel model memakai median per kategori dan dihitung
pada unit yang memperoleh estimasi dari masing-masing model. Pada seluruh
867 unit layak, median per kategori memberikan MAE 394,2 hari, RMSE
743,7 hari, dan MedAE 240,0 hari.

### Pembanding median training keseluruhan

| Unit test | n | MAE (hari) | RMSE (hari) | MedAE (hari) |
| --- | ---: | ---: | ---: | ---: |
| Seluruh unit layak | 867 | 458,2 | 899,0 | 240,0 |
| Diestimasi model gabungan berbobot | 855 | 460,0 | 904,0 | 240,0 |
| Diestimasi model narasi berbobot | 863 | 458,6 | 900,6 | 240,0 |
| Diestimasi model gabungan tanpa bobot | 855 | 460,0 | 904,0 | 240,0 |

### Perbandingan pada irisan unit yang sama

Irisan unit yang memperoleh estimasi pada ketiga model berisi 854 unit.

| Model | n | MAE | RMSE | MedAE |
| --- | ---: | ---: | ---: | ---: |
| Gabungan berbobot | 854 | 371,7 | 661,0 | 222,8 |
| Narasi berbobot | 854 | 406,1 | 690,6 | 245,6 |
| Gabungan tanpa bobot | 854 | 377,2 | 669,5 | 228,0 |
| Median per kategori | 854 | 394,1 | 747,2 | 240,0 |
| Median training keseluruhan | 854 | 460,4 | 904,5 | 240,0 |

### Estimasi ditahan

Semua penahanan pada test memakai alasan `REFERENSI_TIDAK_CUKUP`, yaitu jumlah
referensi yang lolos syarat tidak mencukupi. Tidak ada alasan penahanan lain.

| Model | Total ditahan | Sebaran menurut kategori |
| --- | ---: | --- |
| Gabungan berbobot | 12 | keamanan-negara 2/16, keteriban-umum 1/3, pemerasan 2/10, pencurian 1/249, penggelapan 1/135, penghinaan 2/22, senjata-api 3/3 |
| Narasi berbobot | 4 | keteriban-umum 1/3, senjata-api 3/3 |
| Gabungan tanpa bobot | 12 | sama dengan gabungan berbobot |

### Hasil per kategori

Hanya kategori dengan sedikitnya 10 unit test yang ditampilkan agar angka
perbandingan dapat dibaca. Kategori lebih kecil dilaporkan pada bagian akhir.

**Gabungan berbobot**

| Kategori | n | Diestimasi | CBR MAE | Baseline MAE | CBR RMSE | Baseline RMSE | CBR MedAE | Baseline MedAE |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| kejahatan-terhadap-keamanan-negara | 16 | 14 | 688,5 | 715,7 | 1.062,1 | 805,5 | 403,4 | 705,0 |
| pemalsuan | 18 | 18 | 324,8 | 366,6 | 450,1 | 509,9 | 220,3 | 303,0 |
| pembunuhan | 22 | 22 | 1.010,6 | 1.181,8 | 1.375,2 | 1.677,8 | 610,2 | 720,0 |
| pemerasan-dan-pengancaman | 10 | 8 | 444,7 | 496,3 | 602,1 | 754,2 | 346,7 | 285,0 |
| penadahan | 17 | 17 | 185,6 | 235,6 | 240,4 | 279,4 | 137,7 | 240,0 |
| pencurian | 249 | 248 | 326,5 | 321,3 | 565,2 | 632,1 | 203,0 | 240,0 |
| penganiayaan | 38 | 38 | 413,2 | 521,8 | 748,1 | 915,0 | 243,1 | 360,0 |
| penggelapan | 135 | 134 | 229,8 | 218,5 | 282,2 | 270,1 | 216,2 | 180,0 |
| penghinaan | 22 | 20 | 784,5 | 766,5 | 1.185,5 | 1.198,3 | 448,1 | 495,0 |
| penipuan | 125 | 125 | 242,1 | 213,1 | 291,8 | 264,9 | 210,5 | 210,0 |
| (tanpa kategori) | 194 | 194 | 485,3 | 565,4 | 893,7 | 1.049,7 | 242,7 | 300,0 |

**Narasi berbobot**

| Kategori | n | Diestimasi | CBR MAE | Baseline MAE | CBR RMSE | Baseline RMSE | CBR MedAE | Baseline MedAE |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| kejahatan-terhadap-keamanan-negara | 16 | 16 | 589,6 | 691,9 | 900,4 | 776,9 | 324,6 | 660,0 |
| pemalsuan | 18 | 18 | 294,7 | 366,6 | 394,8 | 509,9 | 235,2 | 303,0 |
| pembunuhan | 22 | 22 | 1.137,1 | 1.181,8 | 1.501,1 | 1.677,8 | 1.021,7 | 720,0 |
| pemerasan-dan-pengancaman | 10 | 10 | 407,2 | 457,0 | 573,8 | 689,9 | 257,7 | 285,0 |
| penadahan | 17 | 17 | 203,6 | 235,6 | 258,7 | 279,4 | 120,4 | 240,0 |
| pencurian | 249 | 249 | 377,6 | 322,3 | 674,8 | 631,9 | 241,2 | 240,0 |
| penganiayaan | 38 | 38 | 569,4 | 521,8 | 894,4 | 915,0 | 398,4 | 360,0 |
| penggelapan | 135 | 135 | 220,2 | 217,1 | 272,7 | 269,2 | 197,3 | 180,0 |
| penghinaan | 22 | 22 | 695,9 | 759,5 | 1.169,5 | 1.162,2 | 333,9 | 540,0 |
| penipuan | 125 | 125 | 235,8 | 213,1 | 298,0 | 264,9 | 189,3 | 210,0 |
| (tanpa kategori) | 194 | 194 | 546,5 | 565,4 | 848,2 | 1.049,7 | 344,3 | 300,0 |

**Gabungan tanpa bobot**

| Kategori | n | Diestimasi | CBR MAE | Baseline MAE | CBR RMSE | Baseline RMSE | CBR MedAE | Baseline MedAE |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| kejahatan-terhadap-keamanan-negara | 16 | 14 | 606,9 | 715,7 | 929,8 | 805,5 | 397,5 | 705,0 |
| pemalsuan | 18 | 18 | 340,4 | 366,6 | 472,8 | 509,9 | 231,0 | 303,0 |
| pembunuhan | 22 | 22 | 1.036,7 | 1.181,8 | 1.444,1 | 1.677,8 | 504,0 | 720,0 |
| pemerasan-dan-pengancaman | 10 | 8 | 486,5 | 496,3 | 662,3 | 754,2 | 410,0 | 285,0 |
| penadahan | 17 | 17 | 188,6 | 235,6 | 246,5 | 279,4 | 140,0 | 240,0 |
| pencurian | 249 | 248 | 330,8 | 321,3 | 569,5 | 632,1 | 213,0 | 240,0 |
| penganiayaan | 38 | 38 | 433,7 | 521,8 | 755,8 | 915,0 | 255,0 | 360,0 |
| penggelapan | 135 | 134 | 232,6 | 218,5 | 284,2 | 270,1 | 213,0 | 180,0 |
| penghinaan | 22 | 20 | 799,5 | 766,5 | 1.189,8 | 1.198,3 | 507,0 | 495,0 |
| penipuan | 125 | 125 | 242,9 | 213,1 | 292,5 | 264,9 | 204,0 | 210,0 |
| (tanpa kategori) | 194 | 194 | 492,9 | 565,4 | 909,4 | 1.049,7 | 243,0 | 300,0 |

Kategori test yang lebih kecil dari 10 unit: kealfaan-mengakibatkan-kematianluka
(7), kejahatan-terhadap-kesusilaan (4), kejahatan-terhadap-keteriban-umum (3),
senjata-api (3), perusakan (2), kehutanan (1), dan mata-uang (1). Angka kategori
ini tidak dipakai untuk menyimpulkan keunggulan salah satu model. Kategori
kejahatan-terhadap-kemerdekaan-orang-lain, lalu-lintas, dan perjudian tidak ada
pada test.

## Pembahasan

Dengan bahasa tugas kuliah: model CBR gabungan berbobot memberi estimasi untuk
855 dari 867 kasus test (98,62%) dan rata-rata meleset sekitar 372 hari. Pada
kasus yang sama, pembanding median per kategori meleset sekitar 394 hari. Jadi
CBR lebih dekat sekitar 22 hari, atau sekitar 5,7%, dan juga lebih baik pada
RMSE (661 vs 747 hari) serta MedAE (223 vs 240 hari). Keunggulan ini tidak
merata: CBR jelas membantu pada unit tanpa kategori, pembunuhan, penganiayaan,
penadahan, pemalsuan, pemerasan, dan kejahatan terhadap keamanan negara.

Sebaliknya, median per kategori masih lebih baik pada kategori terbesar:
pencurian (321 vs 327 hari), penggelapan (219 vs 230 hari), penipuan (213 vs
242 hari), dan penghinaan (767 vs 785 hari). Pola ini masuk akal: untuk kategori
besar, median kategori sudah menjadi tebakan yang kuat karena banyak kasus
berada di sekitar nilai tengah. Kemenangan keseluruhan CBR terutama datang dari
194 unit tanpa kategori (485 vs 565 hari) dan kategori dengan sebaran hukuman
besar seperti pembunuhan (1.011 vs 1.182 hari) dan penganiayaan (413 vs 522
hari). Laporan tetap menyajikan angka ini apa adanya; tidak ada syarat bahwa CBR
harus mengalahkan pembanding.

Varian narasi saja mencapai cakupan tertinggi (99,54%) dan RMSE lebih baik
daripada baseline, tetapi MAE-nya (405 hari) lebih buruk daripada baseline (394
hari) dan lebih buruk daripada varian gabungan. Artinya, menambahkan pasal dan
atribut menaikkan ketepatan, tetapi varian gabungan menahan 8 unit lebih banyak
daripada varian narasi (12 vs 4) karena syarat referensi/cakupan atribut. Varian gabungan tanpa bobot berada di antara
keduanya: lebih baik daripada baseline pada MAE/RMSE/MedAE, tetapi lebih rendah
daripada Reuse berbobot.

Untuk aplikasi, konfigurasi gabungan berbobot layak menjadi pilihan utama
karena akurasi keseluruhan terbaik dengan cakupan tetap tinggi. Varian narasi
dapat ditampilkan sebagai pembanding yang lebih sering memberi angka, dengan
catatan akurasinya lebih rendah. Penahanan hampir seluruhnya terjadi pada
kategori langka (senjata-api 3/3, keteriban-umum 1/3, pemerasan 2/10), jadi
aplikasi perlu menjelaskan bahwa kategori jarang lebih sering tidak mendapat
estimasi.

Batas pembacaan:

- Ini satu pembagian kelompok dengan seed tetap. Konfigurasi dikunci sebelum
  penilaian test dan dipakai kembali saat memeriksa reproduksibilitas.
- Tidak ada label relevansi ahli; yang diukur adalah galat hasil akhir, bukan
  kualitas hukum kasus referensi.
- Korpus adalah subset yang lolos impor (5.782 dari 22.630 XML). Hasil tidak
  mewakili seluruh putusan pidana umum dan bukan audit korpus.
- Kategori dengan kurang dari 10 unit test tidak dapat disimpulkan per kategori.
- Evaluasi ini menilai akurasi prediksi. Pengujian alur Revise/Retain berjalan
  terpisah pada salinan basis kasus dan tidak menambahkan hasil aktual test ke
  basis kasus selama pengukuran.

## Reproduksibilitas

Evaluasi diulang dari workspace terpisah, `data/evaluation-repro` dan
`artifacts/evaluation-repro`, dengan snapshot, seed, dan protokol yang sama.
Workspace ini tidak memakai database atau artefak run pertama. Run ulang
memilih `kandidat-15` yang sama dan menghasilkan seluruh fingerprint serta
angka test yang identik.

Setelah pelaporan median keseluruhan ditambahkan, tahap `test` dijalankan ulang
dalam Docker pada dua salinan workspace, masing-masing dengan manifest, split,
dan konfigurasi terkunci dari run asal. Metrik median keseluruhan cocok pada
kedua salinan, dan SHA-256 detail prediksi test cocok dengan hash di bawah.

Jalankan dari root repo (perintah `docker run` setara dengan overlay compose
yang dipakai saat run ulang untuk memindahkan mount `/workspace` dan
`/artifacts`):

```bash
mkdir -p data/evaluation-repro artifacts/evaluation-repro
docker compose --profile tools build evaluate
docker run --rm \
  -e DATABASE_PATH=/workspace/evaluation.db \
  -v "$PWD/data/raw:/sources:ro" \
  -v "$PWD/data/evaluation-repro:/workspace" \
  -v "$PWD/artifacts/evaluation-repro:/artifacts" \
  cbr-estimasi-lama-hukuman:local \
  node tools/cli/dist/index.js evaluate \
  --workspace /workspace --artifacts /artifacts \
  --source /sources/indo-law --stage all
```

| Pemeriksaan | Run utama | Run ulang |
| --- | --- | --- |
| Fingerprint manifest | `9c03998ea7334dc3` | `9c03998ea7334dc3` |
| Fingerprint split | `f520de0d305a9dfd` | `f520de0d305a9dfd` |
| Fingerprint konfigurasi terkunci | `bd4fadb2b7402393` | `bd4fadb2b7402393` |
| SHA-256 `split-manifest.json` | `e13addc17f98f88ce3aeb0258e0f971adeb5c3035cd3cb8ef64806d2fad8dc60` | `e13addc17f98f88ce3aeb0258e0f971adeb5c3035cd3cb8ef64806d2fad8dc60` |
| SHA-256 `validation-per-unit.jsonl` | `2b69987db18e6f9e455192f0848d5837e40a2f5e33c42640e3e745596d3d3822` | `2b69987db18e6f9e455192f0848d5837e40a2f5e33c42640e3e745596d3d3822` |
| SHA-256 `test-per-unit.jsonl` | `17e83cb93628ee0eaf4060213d56f417d4e094ac0c9d90eff36c6614e0f9ade4` | `17e83cb93628ee0eaf4060213d56f417d4e094ac0c9d90eff36c6614e0f9ade4` |
| Fingerprint prediksi test (gabungan berbobot) | `f0e14a78993bc357` | `f0e14a78993bc357` |
| Fingerprint prediksi test (narasi) | `c9d5ff96d1841114` | `c9d5ff96d1841114` |
| Fingerprint prediksi test (tanpa bobot) | `6ef13cccd5bf2c40` | `6ef13cccd5bf2c40` |
| MAE test gabungan berbobot | 371,7 hari | `371,7 hari` |

Detail per unit dan artefak mentah tetap berada di workspace lokal yang
di-ignore Git. Laporan agregat ini tidak memuat narasi, nama, atau nomor
perkara.

## Lampiran: skor 32 kandidat validasi

| Kandidat | Grid | Cakupan | MAE (hari) |
| --- | ---: | ---: | ---: |
| kandidat-00 | 0 | 99,88% | 441,05 |
| kandidat-01 | 1 | 99,88% | 442,90 |
| kandidat-02 | 2 | 99,42% | 438,46 |
| kandidat-03 | 3 | 99,19% | 439,31 |
| kandidat-04 | 4 | 99,54% | 439,18 |
| kandidat-05 | 5 | 98,85% | 439,20 |
| kandidat-06 | 6 | 98,39% | 436,48 |
| kandidat-07 | 7 | 97,69% | 433,75 |
| kandidat-08 | 8 | 99,88% | 426,72 |
| kandidat-09 | 9 | 99,88% | 426,54 |
| kandidat-10 | 10 | 99,42% | 424,78 |
| kandidat-11 | 11 | 99,19% | 424,64 |
| kandidat-12 | 12 | 99,54% | 424,80 |
| kandidat-13 | 13 | 98,85% | 422,67 |
| kandidat-14 | 14 | 98,39% | 422,66 |
| **kandidat-15** | **15** | **97,69%** | **418,86** |
| kandidat-16 | 16 | 99,88% | 467,23 |
| kandidat-17 | 17 | 99,42% | 455,48 |
| kandidat-18 | 18 | 99,19% | 463,82 |
| kandidat-19 | 19 | 98,96% | 451,81 |
| kandidat-20 | 20 | 99,42% | 465,94 |
| kandidat-21 | 21 | 98,27% | 450,99 |
| kandidat-22 | 22 | 98,39% | 460,96 |
| kandidat-23 | 23 | 96,66% | 446,61 |
| kandidat-24 | 24 | 99,88% | 454,99 |
| kandidat-25 | 25 | 99,42% | 446,51 |
| kandidat-26 | 26 | 99,19% | 453,55 |
| kandidat-27 | 27 | 98,96% | 444,11 |
| kandidat-28 | 28 | 99,42% | 453,65 |
| kandidat-29 | 29 | 98,27% | 441,91 |
| kandidat-30 | 30 | 98,39% | 450,61 |
| kandidat-31 | 31 | 96,66% | 438,73 |
