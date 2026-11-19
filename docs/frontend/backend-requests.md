# Permintaan frontend ke backend

Daftar data dan perubahan yang dibutuhkan UI tetapi belum tersedia di API.
Frontend sekarang tetap berfungsi tanpanya; setiap butir menyebut solusi
sementara yang dipakai. Tidak ada yang diimplementasikan di backend sebagai
bagian dari redesain.

Angka di dokumen ini diukur pada basis kasus Indo-Law hasil impor snapshot
`67340338` (5.782 perkara, 5.773 kelompok, generasi 31.407) dan konfigurasi
aplikasi dengan fingerprint `6a3700e4f7e7e823`.

## Ringkasan prioritas

| # | Permintaan | Prioritas | Ukuran kerja |
| --- | --- | --- | --- |
| 1 | Selaraskan `config/retrieval.json` dengan konfigurasi evaluasi terkunci | **Tinggi** | Kecil (satu file JSON), perlu keputusan tim |
| 2 | Normalisasi nilai `education` dan `occupation` saat impor | Sedang | Sedang (importer + impor ulang) |
| 3 | `GET /api/cases`: filter `category=`, opsi tanpa kategori, `narrationPreview` | Sedang | Kecil–sedang |
| 4 | `GET /api/vocabulary` | Rendah | Kecil |

Bila hanya satu yang bisa dikerjakan, kerjakan nomor 1: itu menyangkut
kebenaran angka yang ditampilkan, bukan kenyamanan tampilan.

---

## 1. Selaraskan `config/retrieval.json` dengan konfigurasi evaluasi terkunci

**Masalah.** Drawer "Cara kerja" menampilkan hasil uji (cakupan 98,62%, MAE
371,7 hari dibanding median per kategori 394,2 hari pada 867 perkara uji).
Angka itu berasal dari `kandidat-15`. Aplikasi yang berjalan masih memakai
konfigurasi placeholder:

| Parameter | Aplikasi sekarang | `kandidat-15` (terkunci) |
| --- | --- | --- |
| Bobot kronologi / pasal / atribut | 1 / 0,5 / 0,1–0,2 per atribut | 0,75 / 0,20 / 0,05 (`attributeGroupWeight`) |
| `maxReferences` | 5 | 5 |
| `minReferences` | 1 | 2 |
| `minScore` | 0 | 0,10 |
| `minAttributeCoverage` | 0 | 0,85 |

Akibatnya angka evaluasi tidak menggambarkan estimasi yang dilihat pengguna,
dan hal ini mudah dipertanyakan saat presentasi. Dengan `minReferences` 1,
estimasi juga keluar dari satu putusan saja; status "Estimasi belum tersedia"
karena putusan terlalu sedikit (`REFERENSI_TIDAK_CUKUP`) praktis tidak pernah
muncul.

**Data pendukung.** Pada contoh kronologi pencurian sepeda motor, lima
putusan teratas bersekor 0,15–0,19, jadi tetap lolos `minScore` 0,10. Kategori
kecil seperti kehutanan (4 perkara), senjata api (5), dan mata uang (6) adalah
yang paling mungkin berubah menjadi "belum tersedia" setelah penyelarasan.
Hal itu memang perilaku yang diharapkan, dan UI sudah punya state serta saran
tindakannya.

**Permintaan.** Ganti isi `config/retrieval.json` dengan konfigurasi
terkunci, lalu pastikan fingerprint di `GET /api/config` sama dengan
fingerprint di artefak evaluasi.

**Setelah selesai, frontend akan** mengganti catatan di "Cara kerja" menjadi
pernyataan bahwa aplikasi memakai konfigurasi yang sama dengan evaluasi.

**Sementara:** "Cara kerja" menyebut bahwa angka evaluasi berasal dari
konfigurasi terkunci, sedangkan aplikasi memakai `config/retrieval.json`
beserta fingerprint-nya.

---

## 2. Normalisasi `education` dan `occupation` saat impor

**Masalah.** Kedua atribut dibandingkan secara kategoris (sama persis = 1,
berbeda = 0). Nilai hasil ekstraksi sangat beragam dan sebagian salah:

| Atribut | Tercatat | Nilai unik | Nilai teratas |
| --- | ---: | ---: | --- |
| `education` | 1.124 perkara | 304 | sma 131, sd 106, **terdakwa 104**, smp 91, slta 39, sd tamat 36, sd tidak tamat 34, smp tamat 32 |
| `occupation` | 4.240 perkara | 764 | swasta 1.065, wiraswasta 583, buruh 279, karyawan swasta 224, **terdakwa 147**, tani 139, petani 82, tidak bekerja 68 |

- "terdakwa" (104 dan 147 perkara) jelas bukan pendidikan atau pekerjaan;
  ekstraksi tampaknya mengambil kata setelah label yang kosong.
- Varian yang maknanya sama dianggap berbeda: sma / slta / sma tamat,
  tani / petani, swasta / karyawan swasta.

Akibatnya pengguna yang mengisi "SMA" tidak cocok dengan putusan bertulis
"slta", dan perkara bertulis "terdakwa" saling cocok satu sama lain tanpa
arti.

**Permintaan.**
- Buang nilai yang jelas bukan isian (misalnya "terdakwa", "-", kosong) saat
  impor, sehingga atribut itu tidak ditulis (tidak diketahui).
- Petakan varian ke nilai kanonis, misalnya pendidikan: `tidak-sekolah`,
  `sd`, `smp`, `sma`, `diploma`, `sarjana`, `pascasarjana`; status tamat/tidak
  tamat boleh disimpan terpisah bila perlu.
- Impor ulang, lalu laporkan perubahan jumlah nilai unik di laporan impor.

**Setelah selesai, frontend akan** mengganti input teks bebas pendidikan dan
pekerjaan dengan pilihan dari daftar kanonis (lihat nomor 4).

**Sementara:** input teks bebas, di-lowercase sebelum dikirim.

**Catatan terkait.** Dua atribut lain hampir tidak pernah tercatat: `role` (26
perkara) dan `victim_count` (1 perkara). Field-nya tetap ada di UI, tetapi
pengguna perlu tahu bahwa isian itu hampir tidak memengaruhi kemiripan. Bila
ekstraksi tidak akan diperbaiki, beri tahu frontend agar field tersebut bisa
disembunyikan.

---

## 3. `GET /api/cases`: filter kategori eksak, tanpa kategori, dan `narrationPreview`

**Masalah.** Filter kategori di Basis kasus menumpang `q=<slug>`. Pada data
saat ini jumlahnya sudah tepat (misalnya pencurian 1.639, penipuan 811,
senjata api 5), tetapi ada tiga kekurangan:

- Kategori dan kata pencarian tidak bisa digabung, karena keduanya memakai
  `q`. UI membuat keduanya saling meniadakan.
- **1.335 perkara (23%) tidak berkategori** dan tidak bisa difilter sama
  sekali.
- Tabel tidak bisa menampilkan potongan kronologi, padahal banyak nomor
  perkara dari pengadilan yang sama mirip satu sama lain.

**Usulan:**

```http
GET /api/cases?limit=20&offset=0&q=tegal&category=pencurian
GET /api/cases?category=__none__
```

- `category` dicocokkan eksak dan digabung dengan `q` (AND).
- Nilai khusus (misalnya `__none__`) untuk perkara tanpa kategori.
- Setiap item `CaseUnitSummary` ditambah `narrationPreview: string | null`
  (±160 karakter pertama kronologi, dipotong di batas kata).

**Sementara:** `q = search || category` (lihat komentar di
`apps/web/src/pages/cases/CasesPage.tsx`); tidak ada filter "Tanpa kategori";
tabel tanpa potongan kronologi.

---

## 4. `GET /api/vocabulary`

**Masalah.** Daftar 20 kategori di `apps/web/src/lib/vocabulary.ts` ditulis
tangan. Untuk snapshot ini daftarnya benar, tetapi akan basi tanpa ketahuan
bila dataset diganti. Jumlah perkara per kategori juga membantu pengguna
memahami kenapa kategori kecil sering membuat estimasi belum tersedia.

**Bentuk respons usulan** (angka dari data saat ini):

```json
{
  "generation": 31407,
  "categories": [
    { "value": "pencurian", "caseCount": 1639 },
    { "value": "penggelapan", "caseCount": 886 },
    { "value": "kehutanan", "caseCount": 4 },
    { "value": "kejahatan-terhadap-kemerdekaan-orang-lain", "caseCount": 2 }
  ],
  "uncategorizedCount": 1335,
  "attributes": {
    "education": [{ "value": "sma", "caseCount": 131 }],
    "occupation": [{ "value": "swasta", "caseCount": 1065 }]
  },
  "limit": 20
}
```

`attributes.*` cukup top-N, diurutkan dari yang terbanyak, dan paling berguna
setelah nomor 2 selesai. Label tampilan tetap diatur frontend; slug dikirim
apa adanya.

**Setelah selesai, frontend akan** menampilkan jumlah perkara di dropdown
kategori dan memakai daftar ini untuk saran pendidikan/pekerjaan.

**Sementara:** daftar hardcode dengan komentar `TEMPORARY`.
