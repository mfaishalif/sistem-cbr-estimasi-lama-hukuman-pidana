# Sumber, akses, dan struktur awal Indo-Law

Tanggal pemeriksaan: 17 November 2026 (UTC dan Asia/Jakarta). Pertanyaan: [Verifikasi sumber, akses, dan struktur awal dataset Indo-Law](https://github.com/mfaishalif/sistem-cbr-estimasi-lama-hukuman-pidana/issues/3), bagian dari [peta pengembangan aplikasi](https://github.com/mfaishalif/sistem-cbr-estimasi-lama-hukuman-pidana/issues/2).

## Ringkasan bukti

Sumber resmi dapat diakses dan dipatok ke commit. Dua contoh XML berhasil diunduh serta diparse; keduanya memiliki teks fakta, amar putusan, dan atribut `lama_hukuman`. Namun, susunan bagian tidak lengkap seperti daftar sebelas bagian dokumentasi. Temuan ini membuktikan ketersediaan contoh, bukan kualitas atau kelayakan seluruh basis kasus. Bukti rinci dan tautan permanen tercantum di bawah.

Riset ini membaca sumber primer, metadata GitHub, dan dua berkas contoh yang dipilih berdasarkan urutan nama. Tidak menggunakan skrip/hasil audit lama, tidak mengunduh seluruh korpus, tidak menghitung statistik isi korpus, dan tidak menetapkan fitur atau metode CBR.

## Sumber dan snapshot

Pada saat pemeriksaan, API resmi menunjukkan cabang default `main`, tanpa tag atau release, dan commit terbaru `67340338adbc63021630947d905627eef0d7e43f` bertanggal `2022-07-07T05:46:38Z`. Gunakan SHA tersebut, bukan nama cabang bergerak, untuk identitas snapshot. Ukuran yang dilaporkan metadata repositori adalah `526155` KiB (sekitar 514 MiB); angka ini bukan ukuran ZIP atau kebutuhan ruang hasil ekstraksi. [Metadata repositori](https://api.github.com/repos/ir-nlp-csui/indo-law), [commit](https://github.com/ir-nlp-csui/indo-law/commit/67340338adbc63021630947d905627eef0d7e43f), [tags](https://api.github.com/repos/ir-nlp-csui/indo-law/tags), [releases](https://api.github.com/repos/ir-nlp-csui/indo-law/releases).

Root tree pada commit itu berisi `LICENSE`, `README.md`, dan `dataset/`. Identitas tree `dataset/` adalah `14db967106b2d10c968d73d7b061774b81f508c8`; endpoint tree yang diperiksa melaporkan `truncated: false`. Tidak ditemukan spesifikasi XSD/DTD atau skrip pengolahan pada root tersebut. Pemeriksaan ini tidak mengklaim inventaris isi seluruh korpus. [Root tree](https://api.github.com/repos/ir-nlp-csui/indo-law/git/trees/67340338adbc63021630947d905627eef0d7e43f), [dataset tree](https://api.github.com/repos/ir-nlp-csui/indo-law/git/trees/14db967106b2d10c968d73d7b061774b81f508c8).

### Klaim dokumentasi penerbit

README menyebut 22.630 dokumen pidana umum, berupa teks hasil ekstraksi PDF dari Direktori Putusan Mahkamah Agung. Setiap XML menggunakan root `putusan`. Sebelas bagian yang didokumentasikan ialah `kepala_putusan`, `identitas`, `riwayat_penahanan`, `riwayat_perkara`, `riwayat_tuntutan`, `riwayat_dakwaan`, `fakta`, `fakta_hukum`, `pertimbangan_hukum`, `amar_putusan`, dan `penutup`. Pembagian train/test penelitian asal tidak tersedia lagi karena tidak dicadangkan. Ini klaim penerbit, bukan hasil penghitungan atau validasi ulang. [README pada snapshot](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/README.md).

Artikel primer Nuranti, Yulianti, dan Husin (2022) menyatakan seleksi putusan pidana tingkat pertama berkekuatan hukum tetap dari Jawa Barat, Jawa Tengah, Jawa Timur, Jakarta, dan Yogyakarta. Artikel menjelaskan penyaringan dari 82.827 metadata menjadi 22.630 dokumen, anotasi manual 1.000 dokumen dan aturan untuk sisanya. Bagian 4.3 juga menyebut 82.827 sebagai dokumen eksperimen; perbedaan penyebutan ini belum direkonsiliasi. Penelitian menggunakan konversi 30 hari per bulan dan 360 hari per tahun. Bagian fakta dijelaskan berisi bukti/keterangan persidangan; amar berisi keputusan dan hukuman. Klaim tersebut tidak memvalidasi setiap XML yang diterbitkan. [Artikel, bagian 4.1–4.3, DOI 10.3390/computers11060088](https://doi.org/10.3390/computers11060088).

## Izin penggunaan yang dinyatakan

README mengizinkan penggunaan gratis tanpa meminta izin, meminta sitasi artikel untuk publikasi, serta melarang menyalin dataset ke repositori publik sendiri tanpa izin. Di sisi lain, berkas `LICENSE` berisi AGPL versi 3. Kedua pernyataan tersedia bersamaan; hubungan dan cakupan penerapannya terhadap data belum dijelaskan oleh sumber yang diperiksa. Catatan ini tidak menyimpulkan bahwa pembatasan redistribusi dapat diabaikan. Kontak penerbit tercantum di README. [Ketentuan README](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/README.md#license), [LICENSE permanen](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/LICENSE).

Artefak riset ini hanya menyimpan catatan dan tautan; tidak menyertakan salinan dataset.

## Observasi dua contoh aktual

Pemilihan: dua entri XML pertama yang dikembalikan dataset tree, bukan sampel acak atau representatif. GET anonim dari `raw.githubusercontent.com` berhasil. Kedua berkas diparse sebagai XML menggunakan parser .NET melalui PowerShell. Identitas berikut berasal dari byte unduhan dan metadata Git tree, bukan penamaan ulang lokal.

| Bukti | Contoh A | Contoh B |
| --- | --- | --- |
| Berkas pada snapshot | [00035681c8d944203f25d2e8215ae2bf.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/00035681c8d944203f25d2e8215ae2bf.xml) | [000399ce26773e18695ce14f519cb9e6.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/000399ce26773e18695ce14f519cb9e6.xml) |
| Ukuran byte | 61.988 | 114.231 |
| Git blob SHA | `d418033772629bd87063db10fdca883f666d05a8` | `08e8d56ef72ddc8d1ae7341e6a84a95f6a04882d` |
| SHA-256 byte unduhan | `df3840631b592a8e45ee4ef9a9f3f48c01cb540597f780fa6e753c9038fc7360` | `0f6b19dd44fd371b00f1c9084fb0ccfa96da9a74927611937a75ee1d2ccd86ae` |
| Identitas perkara pada kepala putusan | 45/Pid.B/2014/PN Kds; PN Kudus | 157/Pid.B/2017/PN Dm; PN Demak (penulisan dinormalisasi dari teks) |
| Metadata hasil | `amar=pidana`, `amar_lainnya=hukum`, `lama_hukuman=210` | `amar=pidana`, `amar_lainnya=hukum`, `lama_hukuman=720` |
| Isi amar tentang durasi | Penjara tujuh bulan | Penjara dua tahun |
| Bagian aktual | 9; `fakta_hukum` dan `pertimbangan_hukum` tidak ada sebagai tag terpisah | 10; `pertimbangan_hukum` tidak ada sebagai tag terpisah |

Pada kedua contoh, root tunggal `putusan` mempunyai sepuluh atribut: `amar`, `amar_lainnya`, `id`, `klasifikasi`, `lama_hukuman`, `lembaga_peradilan`, `provinsi`, `status`, `sub_klasifikasi`, dan `url`. Bagian merupakan anak langsung berisi teks dengan baris baru; tidak ada struktur entitas, terdakwa, pasal, atau hukuman bertingkat di dalam bagian. Teks `fakta` mencakup keterangan saksi, sementara `amar_putusan` memuat durasi dan pengurangan masa penahanan. Dua nilai durasi konsisten secara aritmetis dengan konversi artikel, tetapi atribut XML tidak memiliki penanda unit tersendiri. [Contoh A](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/00035681c8d944203f25d2e8215ae2bf.xml), [contoh B](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/000399ce26773e18695ce14f519cb9e6.xml).

Unit yang terlihat ialah berkas dokumen putusan dengan satu metadata hasil di root. Dua contoh ini tidak membuktikan hubungan satu-dokumen/satu-terdakwa untuk seluruh korpus. Tidak adanya suatu tag juga tidak membuktikan bahwa pembahasan terkait hilang dari keseluruhan teks.

## Akses dan perolehan snapshot untuk audit berikutnya

- [ZIP commit resmi](https://github.com/ir-nlp-csui/indo-law/archive/67340338adbc63021630947d905627eef0d7e43f.zip) diuji dengan HEAD anonim: GitHub mengalihkan ke `codeload.github.com`, lalu menerima HTTP 200 dengan tipe `application/zip`. ZIP penuh belum diunduh atau diekstrak. Respons tidak memberikan `Content-Length`; ukuran transfer dan ruang ekstraksi belum diukur.
- Dua URL raw sampel berhasil diunduh tanpa token, akun, atau layanan berbayar. API GitHub diperiksa dengan `gh` yang sudah terautentikasi; keberhasilan API tidak dipakai untuk mengklaim akses API anonim.
- URL sumber MA tersimpan pada masing-masing XML. Kedua halaman gagal dibuka melalui alat web. GET langsung ke [sumber MA contoh A](https://putusan3.mahkamahagung.go.id/direktori/putusan/00035681c8d944203f25d2e8215ae2bf.html) menerima HTTP 403. Ini hambatan sesi/klien yang diuji, bukan bukti halaman dihapus atau seluruh MA tidak dapat diakses. PDF asli dan kesesuaian XML terhadap PDF belum diverifikasi.

Contoh prosedur perolehan untuk audit independen berikutnya, **belum dijalankan untuk korpus penuh**. Jalankan dari direktori data lokal yang tidak dipublikasikan:

```powershell
$indoLawRevision = '67340338adbc63021630947d905627eef0d7e43f'
$indoLawArchive = "indo-law-$indoLawRevision.zip"
Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/ir-nlp-csui/indo-law/archive/$indoLawRevision.zip" -OutFile $indoLawArchive
Get-FileHash -LiteralPath $indoLawArchive -Algorithm SHA256
Expand-Archive -LiteralPath $indoLawArchive -DestinationPath "indo-law-$indoLawRevision-local"
```

Catat URL, SHA commit, waktu unduhan, hash arsip, dan manifest hash berkas hasil ekstraksi. SHA commit mengidentifikasi tree sumber; hash ZIP adalah rekaman byte unduhan aktual, bukan checksum ZIP resmi penerbit. Proses tersebut memerlukan koneksi ke GitHub/codeload, utilitas unduh, ekstraksi ZIP, dan ruang untuk arsip beserta hasil ekstraksi. Estimasi kapasitas final menunggu unduhan nyata; ukuran metadata GitHub di atas tidak cukup untuk menetapkannya.

## Batas jawaban dan hal yang belum diketahui

Pertanyaan riset awal terjawab: sumber, identitas snapshot, akses contoh, pernyataan izin, bentuk berkas, serta bukti keberadaan fakta dan hasil putusan tersedia. Hal berikut tetap belum ditetapkan:

- Rekonsiliasi cakupan LICENSE dengan ketentuan redistribusi README; belum ada klarifikasi penerbit yang diperoleh dalam riset ini.
- Ukuran arsip/ekstraksi aktual, keberhasilan unduhan penuh, jumlah berkas nyata, validitas XML seluruh korpus, dan kelengkapan tag.
- Akurasi durasi dan unit seluruh korpus, konsistensi metadata versus amar/PDF, variasi jenis hukuman, kasus banyak terdakwa, duplikasi, serta rentang waktu dan cakupan aktual.
- Ketersediaan setiap fakta pada waktu estimasi kasus baru. Anotasi pada putusan historis sendiri tidak membuktikan ketersediaan informasi sebelum putusan.
- Pemetaan berkas ke anotasi manual/otomatis, reproduksi split penelitian lama, dan akses PDF asal yang dapat diandalkan.

Butir ini adalah batas bukti riset pendahuluan, bukan keputusan metodologis atau hasil audit.
