# Permintaan frontend ke backend

Daftar data yang dibutuhkan UI tetapi belum tersedia di API. Frontend saat ini
tetap berfungsi tanpanya; setiap butir menyebut solusi sementara yang dipakai.
Tidak ada yang diimplementasikan di backend sebagai bagian dari redesain.

## 1. `GET /api/vocabulary`

**Alasan UX.** Dropdown kategori di Estimasi dan filter di Basis kasus saat ini
memakai 20 slug yang ditulis tangan di `apps/web/src/lib/vocabulary.ts`. Bila
data impor berubah, daftar bisa basi tanpa ketahuan. Jumlah perkara per
kategori juga membantu pengguna memahami kenapa kategori kecil sering membuat
estimasi belum tersedia. Isian pendidikan dan pekerjaan berupa teks bebas,
sehingga ejaan yang sedikit berbeda ("sma" vs "sma tamat") tidak cocok
dibandingkan. Saran dari nilai yang sudah ada akan mengurangi hal itu.

**Bentuk respons usulan:**

```json
{
  "generation": 31406,
  "categories": [
    { "value": "pencurian", "caseCount": 1834 },
    { "value": "kejahatan-terhadap-keteriban-umum", "caseCount": 41 }
  ],
  "attributes": {
    "education": [{ "value": "sma", "caseCount": 1210 }],
    "occupation": [{ "value": "swasta", "caseCount": 2011 }]
  },
  "limit": 20
}
```

`attributes.*` cukup top-N per nilai, diurutkan dari yang terbanyak. Label
tampilan tetap diatur frontend; slug dikirim apa adanya.

**Sementara:** daftar hardcode dengan komentar `TEMPORARY`; pendidikan dan
pekerjaan berupa input teks yang di-lowercase sebelum dikirim.

## 2. `GET /api/cases`: filter `category=` dan `narrationPreview`

**Alasan UX.** Filter kategori di Basis kasus sekarang menumpang `q=<slug>`.
`q` juga mencocokkan pengadilan, nomor perkara, dan nama terdakwa memakai
`LIKE`, sehingga filter tidak eksak dan tidak bisa digabung dengan kata
pencarian. Akibatnya, UI membuat keduanya saling meniadakan: memilih kategori
mengosongkan pencarian, dan sebaliknya. Tabel juga belum bisa menampilkan
potongan kronologi untuk membedakan perkara bernomor mirip tanpa membuka
drawer.

**Usulan:**

```http
GET /api/cases?limit=20&offset=0&q=jakarta&category=pencurian
```

- `category` dicocokkan eksak dan bisa digabung dengan `q` (AND).
- Setiap item `CaseUnitSummary` ditambah `narrationPreview: string | null`
  (±160 karakter pertama kronologi, dipotong di batas kata).

**Sementara:** `q = search || category`, dengan komentar di
`pages/cases/CasesPage.tsx`; tabel tanpa potongan kronologi.

## 3. Menyelaraskan `config/retrieval.json` dengan konfigurasi evaluasi terkunci

**Alasan UX.** Drawer "Cara kerja" menampilkan hasil evaluasi uji (cakupan
98,62%, MAE 371,7 hari dibanding median per kategori 394,2 hari pada 867
perkara). Angka itu berasal dari `kandidat-15`. Aplikasi masih memakai
konfigurasi placeholder di `config/retrieval.json` (bobot 1/0,5/per-atribut,
`minReferences` 1, `minScore` 0, `minAttributeCoverage` 0). Pengguna bisa salah
mengira angka evaluasi berlaku untuk estimasi yang mereka lihat. Konfigurasi
placeholder juga membuat state "Estimasi belum tersedia" karena putusan terlalu
sedikit (`REFERENSI_TIDAK_CUKUP`) hampir tidak pernah muncul.

**Usulan:** pakai konfigurasi terkunci sebagai konfigurasi aplikasi:

| Parameter | Nilai |
| --- | --- |
| Bobot kronologi / pasal / kelompok atribut | 0,75 / 0,20 / 0,05 (`attributeGroupWeight`) |
| `minReferences` | 2 |
| `minScore` | 0,10 |
| `minAttributeCoverage` | 0,85 |

Fingerprint di `/api/config` lalu akan sama dengan fingerprint di artefak
evaluasi, dan catatan di "Cara kerja" bisa diganti dengan pernyataan bahwa
keduanya sama.

**Sementara:** "Cara kerja" menampilkan catatan bahwa angka evaluasi berasal
dari konfigurasi terkunci, sedangkan aplikasi memakai `config/retrieval.json`
beserta sidiknya dari `/api/config`.
