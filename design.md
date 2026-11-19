# Sistem desain: Estimasi Lama Hukuman

Spesifikasi visual dan bahasa untuk `apps/web`. Sumber kebenaran token ada di
`apps/web/src/index.css`; string UI ada di `apps/web/src/lib/copy.ts`. Dokumen
ini menjelaskan aturannya.

Arah: alat kerja yang tenang, editorial, dan presisi untuk konteks hukum pidana
Indonesia. Halaman terasa seperti kertas: latar off-white, panel hasil putih,
teks hampir hitam, dan satu aksen marun. Hierarki dibangun dari spasi dan
ukuran tipe, bukan garis dan kotak.

## 1. Warna

| Token | Nilai | Pemakaian |
| --- | --- | --- |
| `--paper` | `#F6F4EF` | Latar halaman, drawer |
| `--surface` | `#FFFFFF` | Panel hasil, field |
| `--surface-sunken` | `#EFECE5` | Chip, blok rumus, panel alasan, skeleton |
| `--ink` | `#1B1A17` | Teks utama, titik putusan serupa |
| `--ink-muted` | `#4A4740` | Teks sekunder |
| `--ink-subtle` | `#6B675F` | Metadata, label kecil |
| `--rule` | `#DDD8CE` | Divider; dipakai hemat |
| `--rule-strong` | `#8F877A` | Border field dan kontrol |
| `--accent` | `#7A1F2B` | Tombol primer, penanda estimasi, putusan #1, tautan |
| `--accent-hover` | `#5F1721` | Hover aksen |
| `--accent-soft` | `#F3E6E7` | Highlight kata yang sama, sorotan kartu |
| `--focus` | `#1F4FA8` | Ring fokus (2px, offset 2px) |
| `--positive` | `#2F6B3F` | Konfirmasi simpan |
| `--caution` | `#8A5A00` | Estimasi belum tersedia, hasil usang |
| `--caution-soft` | `#F7EEDB` | Latar banner peringatan |
| `--danger` | `#A32020` | Error validasi, hapus |

Hanya mode terang. Tidak ada `class="dark"`.

### Kontras (diukur, WCAG 2.1)

| Pasangan | Rasio | Syarat |
| --- | ---: | --- |
| ink / paper | 15,8:1 | AA teks |
| ink-muted / paper | 8,4:1 | AA teks |
| ink-subtle / paper | 5,1:1 | AA teks |
| ink-subtle / surface-sunken | 4,8:1 | AA teks |
| accent / paper | 9,3:1 | AA teks |
| putih / accent (tombol) | 10,2:1 | AA teks |
| caution / caution-soft | 5,1:1 | AA teks |
| danger / surface | 7,5:1 | AA teks |
| rule-strong / surface | 3,6:1 | 3:1 komponen UI (1.4.11) |

`--rule-strong` digelapkan dari `#BDB6A8` (2,0:1) ke `#8F877A` agar border
field memenuhi 3:1. `--rule` tetap terang karena hanya dipakai untuk divider
dekoratif.

## 2. Tipografi

Dua keluarga saja, keduanya dipaket lokal lewat Fontsource (tanpa CDN):

- **Poppins** (`@fontsource/poppins`, statis; hanya weight 400 dan 600 yang
  dimuat), dipakai pada weight 600, tracking normal. Hanya untuk heading:
  judul halaman, judul bagian, angka estimasi, dan angka hukuman di
  kartu/drawer. Kelas Tailwind-nya `font-heading`.
- **Inter** (`@fontsource-variable/inter`) untuk body dan semua UI lainnya:
  navigasi, label, form, isi kartu, kronologi, tabel, metadata, tombol, rumus.

| Peran | Ukuran | Keluarga |
| --- | --- | --- |
| Angka estimasi (satu-satunya ukuran display) | 52–64px | Poppins 600 |
| Judul halaman | 32–40px | Poppins 600 |
| Judul bagian / drawer | 18–24px | Poppins 600 |
| Hukuman di kartu | 20px | Poppins 600 |
| Body | 15–16px, line-height 1.55 | Inter |
| Metadata | minimal 13px | Inter |

Tidak ada font monospace. Nomor perkara, pasal, dan angka tabel memakai Inter
dengan kelas `.tabular` (`font-variant-numeric: tabular-nums`, fitur `tnum` dan
`zero`). `--font-mono` sengaja diarahkan ke Inter.

Poppins tidak dipakai untuk label, tombol, atau teks isi.

## 3. Ruang, bentuk, garis

- Skala spasi: 4, 8, 12, 16, 24, 32, 48, 64.
- Radius 4px (`rounded-sm`) untuk chip, 6px (`rounded-md`) untuk field, tombol,
  dan panel. Tanpa bayangan dan tanpa gradien.
- Border hanya pada: field input (`--rule-strong`), satu panel hasil
  (`--rule`), dan divider antarbagian besar (`border-t --rule`).
- Kartu putusan serupa **tanpa border atau kotak**; dipisahkan jarak 24px dan
  satu divider tipis di antara item.
- Bagian lipat (Tambah detail perkara, Rincian perhitungan, Lihat alasan
  kemiripan) tampil sebagai baris teks dengan chevron, tanpa kotak.
- Target sentuh minimal 44px (tombol, chip, segmented, titik grafik lewat area
  klik tak terlihat).

## 4. Komponen

| Komponen | File | Aturan |
| --- | --- | --- |
| Button | `ui/button.tsx` | `primary` (marun) satu per tampilan; `secondary` outline; `ghost`/`link` teks; `danger` hanya di dialog hapus |
| Field | `ui/field.tsx` | Urutan GOV.UK: label → satu baris bantuan (opsional) → pesan error → kontrol |
| Input, Select, Textarea | `ui/input.tsx` dll. | Tinggi 44px; textarea tumbuh mengikuti isi; select native |
| Segmented | `ui/toggle-group.tsx` | Radix Toggle Group; "Belum diketahui" adalah pilihan, bukan kosong |
| ChipSelect | `ui/chip.tsx` | Multi-pilih dengan `aria-pressed`; nilai tersimpan di luar daftar tetap tampil |
| Disclosure | `ui/disclosure.tsx` | Radix Collapsible; meta ("2 terisi") dan ringkasan chip saat tertutup |
| Tooltip | `ui/tooltip.tsx` | Hanya pelengkap; info yang sama harus ada sebagai teks |
| Sheet | `ui/sheet.tsx` | Radix Dialog sebagai drawer kanan; fokus terkunci, Esc menutup |
| ConfirmDialog | `ui/dialog.tsx` | `alertdialog` untuk hapus; menyebut nomor perkara |
| ErrorSummary | `ui/error-summary.tsx` | Muncul di atas form, menerima fokus, menautkan tiap pesan ke field |
| RankBadge | `estimate/RankBadge.tsx` | Lingkaran nomor; #1 marun, lainnya hitam; sama di grafik dan kartu |

### Grafik rentang hukuman

`components/estimate/SentenceRange.tsx`, logika di `lib/range.ts`.

- Sumbu horizontal dalam bulan (30 hari), dari min sampai max dengan padding;
  label tick "6 bln", "1 thn", "1 thn 6 bln".
- Satu titik = satu putusan serupa, bernomor sama dengan daftar. Luas titik
  sebanding dengan `reuse.weightShare`. Putusan #1 marun, lainnya hitam.
- Titik yang bertabrakan ditumpuk ke lajur di atasnya; #1 selalu di sumbu.
- Garis marun penuh = estimasi, berlabel "Estimasi ± 11 bulan". Garis putus-putus
  hitam = putusan aktual (muncul setelah diisi).
- Titik adalah `<button>`: hover/fokus menyorot kartu yang sama, klik menggulir
  ke kartu. Hover/fokus kartu menyorot titiknya.
- Tanpa legenda; di bawah grafik hanya satu kalimat dengan angka nyata tentang
  cara estimasi ditimbang. `aria-label` grup merangkum rentang; daftar kartu adalah
  versi teksnya.

## 5. Bahasa

### Istilah inti

| Istilah | Arti | Contoh |
| --- | --- | --- |
| perkara | Kejadian yang sedang diestimasi atau disimpan (satu terdakwa) | kronologi perkara, detail perkara, Tambah perkara |
| putusan | Hasil pengadilan atas perkara terdahulu, termasuk hukumannya | putusan serupa, putusan aktual |
| basis kasus | Kumpulan perkara beserta putusannya | Basis kasus, simpan ke basis kasus |
| estimasi | Angka yang dihitung sistem | estimasi hukuman, estimasi belum tersedia |
| hukuman | Lama pidana penjara | rentang hukuman, hukuman 8 bulan |

"Kasus" hanya muncul dalam frasa "basis kasus". Kata "perkiraan" tidak
dipakai; gunakan "estimasi".

### Aturan menulis

- Fungsi sistem dijelaskan sekali, di kalimat pengantar halaman Estimasi.
- Kalimat aktif dan pendek; maksimal satu kalimat bantuan per bagian; judul
  tanpa titik.
- Setiap angka diberi satuan atau keterangan jenisnya (hari, %, peringkat,
  skor).
- Hasil bukan rekomendasi. Satu baris disclaimer di bawah angka estimasi;
  tidak diulang di kartu.
- Tingkat kemiripan ditulis sebagai persen dari skor, tanpa label kualitatif.
- Istilah 4R hanya di drawer "Cara kerja".
- Kode penahanan mentah, sidik konfigurasi, dan generasi basis kasus hanya di
  "Rincian perhitungan".
- Pesan error menyebut cara memperbaikinya.
- Format: `Intl` dengan `id-ID`; durasi lewat `lib/duration.ts` (1 bulan = 30
  hari, 1 tahun = 360 hari); rupiah "Rp12.500.000"; tanggal "19 Nov 2026".

## 6. Aksesibilitas

- Semua input berlabel; grup kontrol memakai `aria-labelledby`.
- Fokus terlihat: outline `--focus` 2px, offset 2px.
- Pengumuman hasil lewat region `aria-live="polite"` yang ringkas.
- Drawer dan dialog mengunci fokus (Radix).
- Animasi minimal dan dimatikan saat `prefers-reduced-motion: reduce`.
- Layout aman sampai 360px: tabel menjadi daftar, grafik menumpuk titik.

## 7. Larangan

Gradien, glassmorphism, glow, bayangan di kartu, emoji, ikon dekoratif di
judul, badge untuk setiap informasi, animasi berlebihan, kartu di dalam kartu,
pola "EYEBROW KAPITAL + judul besar bertitik", teks bantuan di bawah setiap
field, istilah internal di permukaan UI (CRUD, generasi, fingerprint, kandidat
layak, Retrieve/Reuse sebagai label tombol, kode penahanan mentah), angka
desimal panjang, badge status yang muncul dua kali, font ketiga, dan font
monospace.
