# Contoh Input Manual dan Perhitungan CBR

Dokumen ini memberi satu contoh lengkap alur **Retrieve → Reuse → Revise →
Retain** yang dihitung dengan tangan. Datanya **sintetis** (bukan putusan nyata)
dan sengaja dibuat kecil agar setiap angka bisa dicek dengan kalkulator.

Contoh ini sudah dijalankan lewat mesin asli (`packages/cbr`) dengan konfigurasi
[`config/retrieval.json`](../../config/retrieval.json); hasil akhirnya sama
(lihat [Cek dengan mesin aplikasi](#cek-dengan-mesin-aplikasi)).

Konvensi penulisan:

- Angka ditampilkan 4 desimal dan setiap langkah memakai angka tampilan langkah
  sebelumnya, persis seperti hitungan manual. Mesin memakai presisi penuh,
  sehingga digit terakhir bisa berbeda ±0,0001.
- `ln` adalah logaritma natural.
- 1 bulan = 30 hari dan 1 tahun = 360 hari (konvensi aplikasi).

## 1. Parameter yang dipakai

Diambil dari `config/retrieval.json`.

| Parameter | Nilai | Arti |
| --- | --- | --- |
| `minTokenLength` | 1 | Semua token dipakai, termasuk kata pendek seperti "di". |
| `stopwords` | kosong | Tidak ada kata yang dibuang. |
| `minDocumentFrequency` | 2 | Istilah harus muncul di minimal 2 kasus agar masuk kosakata. |
| `sublinearTermFrequency` | false | TF = jumlah kemunculan mentah. |
| `smoothInverseDocumentFrequency` | true | IDF = ln((N+1)/(df+1)) + 1. |
| `narrativeWeight` | 0,75 | Bobot kronologi. |
| `articleWeight` | 0,2 | Bobot pasal dakwaan. |
| `attributeGroupWeight` | 0,05 | Bobot total detail perkara, dibagi rata ke n atribut yang diisi di kueri. |
| `categoryRestriction` | `when-known` | Bila kategori diisi, hanya kasus berkategori sama yang dicari. |
| `minScore` | 0,1 | Skor harus > 0,1. |
| `minAttributeCoverage` | 0,85 | Coverage harus ≥ 0,85. |
| `maxReferences` / `minReferences` | 5 / 2 | Maksimal 5 referensi; kurang dari 2 → estimasi ditahan. |
| `rounding` | `nearest-day-half-up` | Dibulatkan ke hari terdekat, 0,5 ke atas. |

## 2. Input

### 2.1 Basis kasus (5 putusan terdahulu)

| Kasus | Kronologi | Kategori | Pasal dakwaan | Jenis kelamin | Riwayat dihukum | Putusan aktual |
| --- | --- | --- | --- | --- | --- | --- |
| K1 | Terdakwa mencuri sepeda motor korban di parkiran. | Pencurian | KUHP 362 | Laki-laki | Belum pernah | 8 bulan = **240 hari** |
| K2 | Terdakwa mencuri sepeda motor dengan kunci palsu. | Pencurian | KUHP 363 ayat 1 | Laki-laki | Pernah | 1 tahun = **360 hari** |
| K3 | Terdakwa mencuri handphone korban di rumah. | Pencurian | *(tidak tercatat)* | Perempuan | Belum pernah | 6 bulan = **180 hari** |
| K4 | Terdakwa bersama teman mencuri motor dengan kekerasan. | Pencurian | KUHP 363 ayat 1, KUHP 365 ayat 1 | Laki-laki | *(tidak diketahui)* | 1 tahun 6 bulan = **540 hari** |
| K5 | Terdakwa menipu korban dengan menjual motor. | Penipuan | KUHP 378 | Laki-laki | Belum pernah | 10 bulan = **300 hari** |

### 2.2 Kasus baru (kueri) yang diisi di halaman Estimasi

| Field form | Isi |
| --- | --- |
| Kronologi | Terdakwa mencuri motor korban dengan kunci palsu di parkiran. |
| Kategori | Pencurian |
| Pasal dakwaan | KUHP 363 ayat 1 |
| Jenis kelamin | Laki-laki |
| Riwayat dihukum | Pernah dihukum |
| Detail lain | Dikosongkan (tidak diketahui) |

## 3. Retrieve — Langkah 1: Tokenisasi

Narasi dinormalisasi (huruf kecil, tanda baca menjadi spasi) lalu dipecah per
kata.

| Dokumen | Rumus | Token | Jumlah token |
| --- | --- | --- | ---: |
| K1 | `lowercase → hapus tanda baca → split spasi` | terdakwa, mencuri, sepeda, motor, korban, di, parkiran | 7 |
| K2 | sama | terdakwa, mencuri, sepeda, motor, dengan, kunci, palsu | 7 |
| K3 | sama | terdakwa, mencuri, handphone, korban, di, rumah | 6 |
| K4 | sama | terdakwa, bersama, teman, mencuri, motor, dengan, kekerasan | 7 |
| K5 | sama | terdakwa, menipu, korban, dengan, menjual, motor | 6 |
| Kueri | sama | terdakwa, mencuri, motor, korban, dengan, kunci, palsu, di, parkiran | 9 |

## 4. Retrieve — Langkah 2: Document Frequency dan IDF

IDF di-*fit* dari **seluruh 5 kasus** basis kasus (N = 5), termasuk K5 yang
berbeda kategori. Kueri tidak ikut menghitung df.

| Istilah | Muncul di | df | Rumus IDF | Substitusi | IDF | IDF² |
| --- | --- | ---: | --- | --- | ---: | ---: |
| terdakwa | K1, K2, K3, K4, K5 | 5 | ln((N+1)/(df+1)) + 1 | ln(6/6) + 1 = 0 + 1 | 1,0000 | 1,0000 |
| mencuri | K1, K2, K3, K4 | 4 | ln((N+1)/(df+1)) + 1 | ln(6/5) + 1 = 0,1823 + 1 | 1,1823 | 1,3979 |
| motor | K1, K2, K4, K5 | 4 | ln((N+1)/(df+1)) + 1 | ln(6/5) + 1 = 0,1823 + 1 | 1,1823 | 1,3979 |
| korban | K1, K3, K5 | 3 | ln((N+1)/(df+1)) + 1 | ln(6/4) + 1 = 0,4055 + 1 | 1,4055 | 1,9753 |
| dengan | K2, K4, K5 | 3 | ln((N+1)/(df+1)) + 1 | ln(6/4) + 1 = 0,4055 + 1 | 1,4055 | 1,9753 |
| sepeda | K1, K2 | 2 | ln((N+1)/(df+1)) + 1 | ln(6/3) + 1 = 0,6931 + 1 | 1,6931 | 2,8667 |
| di | K1, K3 | 2 | ln((N+1)/(df+1)) + 1 | ln(6/3) + 1 = 0,6931 + 1 | 1,6931 | 2,8667 |
| parkiran, kunci, palsu, handphone, rumah, bersama, teman, kekerasan, menipu, menjual | masing-masing 1 kasus | 1 | df < `minDocumentFrequency` (2) | — | **tidak masuk kosakata** | — |

Kosakata akhir: 7 istilah. Karena tidak ada kata yang berulang dalam satu
narasi, TF setiap istilah = 1, sehingga **bobot w = TF × IDF = IDF**.

## 5. Retrieve — Langkah 3: Vektor TF-IDF dan norma

| Dokumen | Istilah yang dikenali | Rumus norma | Substitusi (Σ IDF²) | ‖·‖² | ‖·‖ |
| --- | --- | --- | --- | ---: | ---: |
| K1 | terdakwa, mencuri, sepeda, motor, korban, di | ‖d‖ = √Σ w(t,d)² | 1 + 1,3979 + 2,8667 + 1,3979 + 1,9753 + 2,8667 | 11,5045 | 3,3918 |
| K2 | terdakwa, mencuri, sepeda, motor, dengan | ‖d‖ = √Σ w(t,d)² | 1 + 1,3979 + 2,8667 + 1,3979 + 1,9753 | 8,6378 | 2,9390 |
| K3 | terdakwa, mencuri, korban, di | ‖d‖ = √Σ w(t,d)² | 1 + 1,3979 + 1,9753 + 2,8667 | 7,2399 | 2,6907 |
| K4 | terdakwa, mencuri, motor, dengan | ‖d‖ = √Σ w(t,d)² | 1 + 1,3979 + 1,3979 + 1,9753 | 5,7711 | 2,4023 |
| K5 | terdakwa, korban, dengan, motor | ‖d‖ = √Σ w(t,d)² | 1 + 1,9753 + 1,9753 + 1,3979 | 6,3485 | 2,5196 |
| Kueri | terdakwa, mencuri, motor, korban, dengan, di (6 dari 9 token; kunci, palsu, parkiran tidak dikenali) | ‖q‖ = √Σ w(t,q)² | 1 + 1,3979 + 1,3979 + 1,9753 + 1,9753 + 2,8667 | 10,6131 | 3,2578 |

## 6. Retrieve — Langkah 4: Filter kategori

| Aturan | Rumus/Kondisi | Hasil |
| --- | --- | --- |
| Kueri berkategori "pencurian" dan `categoryRestriction = when-known` | kandidat = {kasus \| kategori = kategori kueri} | K1, K2, K3, K4 lanjut dihitung |
| K5 berkategori "penipuan" | kategori ≠ "pencurian" | **K5 tidak dihitung skornya** (tetapi tetap ikut membentuk IDF di Langkah 2) |

## 7. Retrieve — Langkah 5: Kemiripan kronologi (cosine)

Karena semua bobot = IDF, perkalian titik q·d cukup menjumlahkan IDF² istilah
yang **ada di kedua sisi**.

| Kasus | Istilah bersama | Rumus | q·d (Σ IDF² bersama) | ‖q‖ × ‖d‖ | cos(q,d) |
| --- | --- | --- | --- | --- | ---: |
| K1 | terdakwa, mencuri, motor, korban, di | cos = Σ w(t,q)·w(t,d) ÷ (‖q‖·‖d‖) | 1 + 1,3979 + 1,3979 + 1,9753 + 2,8667 = 8,6378 | 3,2578 × 3,3918 = 11,0498 | 0,7817 |
| K2 | terdakwa, mencuri, motor, dengan | sama | 1 + 1,3979 + 1,3979 + 1,9753 = 5,7711 | 3,2578 × 2,9390 = 9,5747 | 0,6027 |
| K3 | terdakwa, mencuri, korban, di | sama | 1 + 1,3979 + 1,9753 + 2,8667 = 7,2399 | 3,2578 × 2,6907 = 8,7658 | 0,8259 |
| K4 | terdakwa, mencuri, motor, dengan | sama | 1 + 1,3979 + 1,3979 + 1,9753 = 5,7711 | 3,2578 × 2,4023 = 7,8262 | 0,7374 |

Perhatikan: berdasarkan kronologi saja, K3 paling mirip (0,8259).

## 8. Retrieve — Langkah 6: Kemiripan per komponen

Bobot atribut: kueri mengisi **n = 2** detail perkara (jenis kelamin dan riwayat
dihukum), sehingga tiap atribut berbobot 0,05 ÷ 2 = **0,025**.

Komponen yang tidak diketahui di salah satu sisi **tidak dihitung** (bukan
dianggap 0) dan bobotnya tidak masuk penyebut skor.

| Kasus | Komponen | Bobot (b) | Rumus kemiripan (s) | Substitusi | s | Kontribusi b × s |
| --- | --- | ---: | --- | --- | ---: | ---: |
| K1 | Kronologi | 0,75 | cosine | Langkah 5 | 0,7817 | 0,5863 |
| K1 | Pasal dakwaan | 0,2 | Jaccard \|A∩B\| ÷ \|A∪B\| | {363(1)} vs {362} → 0 ÷ 2 | 0,0000 | 0,0000 |
| K1 | Jenis kelamin | 0,025 | sama = 1, beda = 0 | laki-laki = laki-laki | 1 | 0,0250 |
| K1 | Riwayat dihukum | 0,025 | sama = 1, beda = 0 | pernah ≠ belum pernah | 0 | 0,0000 |
| K2 | Kronologi | 0,75 | cosine | Langkah 5 | 0,6027 | 0,4520 |
| K2 | Pasal dakwaan | 0,2 | Jaccard \|A∩B\| ÷ \|A∪B\| | {363(1)} vs {363(1)} → 1 ÷ 1 | 1,0000 | 0,2000 |
| K2 | Jenis kelamin | 0,025 | sama = 1, beda = 0 | laki-laki = laki-laki | 1 | 0,0250 |
| K2 | Riwayat dihukum | 0,025 | sama = 1, beda = 0 | pernah = pernah | 1 | 0,0250 |
| K3 | Kronologi | 0,75 | cosine | Langkah 5 | 0,8259 | 0,6194 |
| K3 | Pasal dakwaan | 0,2 | Jaccard | K3 tidak punya pasal → **tidak dibandingkan** | — | — |
| K3 | Jenis kelamin | 0,025 | sama = 1, beda = 0 | laki-laki ≠ perempuan | 0 | 0,0000 |
| K3 | Riwayat dihukum | 0,025 | sama = 1, beda = 0 | pernah ≠ belum pernah | 0 | 0,0000 |
| K4 | Kronologi | 0,75 | cosine | Langkah 5 | 0,7374 | 0,5531 |
| K4 | Pasal dakwaan | 0,2 | Jaccard \|A∩B\| ÷ \|A∪B\| | {363(1)} vs {363(1), 365(1)} → 1 ÷ 2 | 0,5000 | 0,1000 |
| K4 | Jenis kelamin | 0,025 | sama = 1, beda = 0 | laki-laki = laki-laki | 1 | 0,0250 |
| K4 | Riwayat dihukum | 0,025 | sama = 1, beda = 0 | K4 tidak diketahui → **tidak dibandingkan** | — | — |

## 9. Retrieve — Langkah 7: Skor total, coverage, dan seleksi

Rumus:

```text
skor     = Σ(bobot × kemiripan) ÷ Σ(bobot komponen yang dapat dibandingkan)
coverage = bobot opsional yang dibandingkan ÷ bobot opsional yang diketahui kueri
```

Bobot opsional yang diketahui kueri = pasal 0,2 + kelompok atribut 0,05 = **0,25**.

| Kasus | Σ kontribusi | Σ bobot dibandingkan | Skor | Bobot opsional dibandingkan | Coverage | Syarat skor > 0,1 | Syarat coverage ≥ 0,85 | Status |
| --- | --- | --- | ---: | --- | ---: | --- | --- | --- |
| K1 | 0,5863 + 0 + 0,025 + 0 = 0,6113 | 0,75 + 0,2 + 0,025 + 0,025 = 1,000 | 0,6113 ÷ 1,000 = **0,6113** | 0,2 + 0,025 + 0,025 = 0,25 | 0,25 ÷ 0,25 = 1,00 | ✔ | ✔ | Lolos |
| K2 | 0,4520 + 0,2 + 0,025 + 0,025 = 0,7020 | 1,000 | 0,7020 ÷ 1,000 = **0,7020** | 0,25 | 1,00 | ✔ | ✔ | Lolos |
| K3 | 0,6194 + 0 + 0 = 0,6194 | 0,75 + 0,025 + 0,025 = 0,800 | 0,6194 ÷ 0,800 = **0,7743** | 0,025 + 0,025 = 0,05 | 0,05 ÷ 0,25 = **0,20** | ✔ | ✘ | **Ditolak** (coverage) |
| K4 | 0,5531 + 0,1 + 0,025 = 0,6781 | 0,75 + 0,2 + 0,025 = 0,975 | 0,6781 ÷ 0,975 = **0,6955** | 0,2 + 0,025 = 0,225 | 0,225 ÷ 0,25 = 0,90 | ✔ | ✔ | Lolos |

K3 punya kronologi paling mirip, tetapi ditolak karena pasal dakwaannya tidak
tercatat sehingga hanya 20% informasi opsional kueri yang bisa dibandingkan.

Urutan referensi (skor menurun, maksimal 5):

| Peringkat | Kasus | Skor | Putusan aktual |
| ---: | --- | ---: | --- |
| 1 | K2 | 0,7020 | 360 hari |
| 2 | K4 | 0,6955 | 540 hari |
| 3 | K1 | 0,6113 | 240 hari |

Jumlah referensi 3 ≥ `minReferences` (2), jadi estimasi **tidak ditahan**.

## 10. Reuse — Rata-rata berbobot skor

```text
estimasi = Σ(skor × hukuman) ÷ Σ(skor), dibulatkan ke hari terdekat
```

| Kasus | Skor (s) | Hukuman (h, hari) | Rumus | s × h | Porsi bobot s ÷ Σs |
| --- | ---: | ---: | --- | ---: | ---: |
| K2 | 0,7020 | 360 | s × h | 0,7020 × 360 = 252,7200 | 0,7020 ÷ 2,0088 = 34,95% |
| K4 | 0,6955 | 540 | s × h | 0,6955 × 540 = 375,5700 | 0,6955 ÷ 2,0088 = 34,62% |
| K1 | 0,6113 | 240 | s × h | 0,6113 × 240 = 146,7120 | 0,6113 ÷ 2,0088 = 30,43% |
| **Jumlah** | **Σs = 2,0088** | | | **Σ(s × h) = 774,9020** | 100% |

| Langkah | Rumus | Substitusi | Hasil |
| --- | --- | --- | --- |
| Estimasi mentah | Σ(s × h) ÷ Σs | 774,9020 ÷ 2,0088 | 385,7537 hari |
| Pembulatan | round half up | 385,7537 → 386 | **386 hari** |
| Konversi | tahun = ⌊hari ÷ 360⌋, bulan = ⌊sisa ÷ 30⌋, hari = sisa mod 30 | 386 = 1 × 360 + 0 × 30 + 26 | **1 tahun 26 hari** (± 1 tahun 1 bulan) |

Sebagai pembanding, rata-rata biasa tanpa bobot = (360 + 540 + 240) ÷ 3 = 380
hari. Rata-rata berbobot sedikit lebih tinggi karena K2 dan K4 (hukuman lebih
berat) lebih mirip daripada K1.

### Cek dengan mesin aplikasi

Hasil `estimateWithIndex` pada data yang sama (presisi penuh):

| Besaran | Hitungan manual | Mesin aplikasi |
| --- | ---: | ---: |
| Skor K2 / K4 / K1 | 0,7020 / 0,6955 / 0,6113 | 0,7021 / 0,6954 / 0,6113 |
| Coverage K3 (ditolak) | 0,20 | 0,20 (1 kandidat ditolak karena coverage) |
| Σ(s × h) | 774,9020 | 774,9870 |
| Σs | 2,0088 | 2,0088 |
| Estimasi mentah | 385,7537 | 385,7993 |
| **Estimasi akhir** | **386 hari** | **386 hari** |

Selisih di digit ketiga/keempat berasal dari pembulatan tampilan 4 desimal.

## 11. Revise — Membandingkan dengan putusan aktual

Misalkan putusan sebenarnya untuk kasus baru adalah **1 tahun 2 bulan**.

| Langkah | Rumus | Substitusi | Hasil |
| --- | --- | --- | --- |
| Putusan aktual ke hari | tahun × 360 + bulan × 30 + hari | 1 × 360 + 2 × 30 + 0 | 420 hari |
| Selisih | aktual − estimasi | 420 − 386 | +34 hari |
| Kalimat di UI | selisih > 0 → "lebih tinggi" | | "Selisih 34 hari lebih tinggi dari estimasi (± 1 bulan)." |

Revise hanya membandingkan; basis kasus belum berubah.

## 12. Retain — Menyimpan ke basis kasus

| Field | Nilai yang disimpan |
| --- | --- |
| Kasus | K6 (baru) |
| Fakta | Persis sama dengan kueri di bagian 2.2 |
| Putusan aktual | **420 hari** (putusan sebenarnya, **bukan** estimasi 386 hari) |
| Efek | Generasi basis kasus naik, indeks lama dibatalkan; estimasi berikutnya menghitung ulang IDF dengan N = 6. |

Setelah K6 tersimpan, istilah "kunci", "palsu", dan "parkiran" kini muncul di 2
kasus (df = 2), sehingga pada estimasi berikutnya ketiganya masuk kosakata.
