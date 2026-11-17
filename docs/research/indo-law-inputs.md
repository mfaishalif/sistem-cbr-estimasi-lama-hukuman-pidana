# Kandidat input dari sampel mentah Indo-Law

Pemeriksaan: 18 November 2026. Menjawab [riset #13](https://github.com/mfaishalif/sistem-cbr-estimasi-lama-hukuman-pidana/issues/13) untuk [keputusan #12 yang tetap terbuka](https://github.com/mfaishalif/sistem-cbr-estimasi-lama-hukuman-pidana/issues/12).

## Jawaban yang didukung sampel

Kandidat input paling masuk akal untuk dibahas berikutnya ialah **narasi kejadian sebelum putusan dan daftar pasal dakwaan beserta alternatif/subsidaritasnya**. Karakteristik terdakwa, peran, korban/dampak, kerugian, barang yang terlibat, dan penggunaan senjata juga terlihat dalam teks, tetapi belum terbukti tersedia konsisten atau mudah diekstrak. Ini usulan berdasarkan observasi, bukan spesifikasi input yang sudah disetujui, bukti manfaat prediktif, atau hasil audit korpus.

Tidak ada atribut XML terstruktur untuk umur, pasal dakwaan, kerugian, atau peran. Nama bagian XML juga tidak dapat dijadikan jaminan aman: contoh `fakta` mengandung amar penjara; `fakta_hukum` mengandung pertimbangan hakim; bahkan `riwayat_dakwaan` dapat berisi pembahasan tuntutan dan pembuktian. Bukti primer dirinci di bawah.

## Sumber dan cara pemilihan

Sumber resmi dipatok pada commit [`67340338adbc63021630947d905627eef0d7e43f`](https://github.com/ir-nlp-csui/indo-law/commit/67340338adbc63021630947d905627eef0d7e43f), dengan [tree dataset `14db967106b2d10c968d73d7b061774b81f508c8`](https://api.github.com/repos/ir-nlp-csui/indo-law/git/trees/14db967106b2d10c968d73d7b061774b81f508c8). Respons tree baru diperoleh melalui `gh api`, berisi **22.630 entri blob `.xml`**, `truncated=false`. Ini denominator inventaris path, bukan hasil membaca isi seluruh korpus.

Pemilihan dilakukan sebelum membaca isinya: untuk setiap path relatif terhadap `dataset/`, hitung SHA-256 dari byte UTF-8 string **`indo-law-inputs-v1\n` + path**, dengan `\n` berarti satu karakter LF, tanpa `dataset/` di depan dan tanpa baris baru setelah nama berkas. Urutkan digest heksadesimal menaik dan ambil 48 pertama. Digest pertama `0009383531ce8159d8fa65f5dee8219792b0d7d61cd7ce622d9395f38866af9a`; terakhir `00a2d8a52590e63bbfeaacbecacd39a5ae16d090cefe8c19fc0be4b812cd1492`. Daftar lengkap ada di lampiran. Ini sampel deterministik tanpa stratifikasi, bukan sampel representatif yang telah dibuktikan.

Hanya 48 XML terpilih yang diunduh baru melalui GET `https://raw.githubusercontent.com/ir-nlp-csui/indo-law/<commit>/dataset/<path>`: **48/48 berhasil diparse** memakai `xml.etree.ElementTree`, total **2.629.825 byte**. Git blob SHA-1 yang dihitung dari byte tiap unduhan cocok dengan SHA blob tree untuk **48/48**. Skrip, manifest, dan raw disimpan sementara di luar repositori; dataset tidak disalin ke artefak publik. Tidak membaca atau menjalankan skrip/hasil audit lama, tidak mengunduh ZIP/clone korpus, dan tidak memeriksa PDF asal.

Metadata sampel membagi **26 `pidana-umum` dan 22 `pidana-khusus`**. Denominator 26 di bawah hanya berarti label metadata, **belum lolos pemeriksaan cakupan hukum**. Subkategori pada 26 itu: penipuan 6; penggelapan 4; kejahatan-terhadap-keamanan-negara 4; pencurian 2; tidak-diketahui 2; kealfaan-mengakibatkan-kematianluka 2; penghinaan 2; pembunuhan, pemerasan-dan-pengancaman, kehutanan, dan penadahan masing-masing 1. Angka ini diperoleh dari atribut seluruh 48 path pada lampiran, bukan ekstrapolasi korpus.

Pembacaan semantik dilakukan langsung pada **19 XML**: 17 berlabel umum (nomor 1, 3, 5, 6, 9, 10, 12, 14, 15, 16, 18, 19, 23, 26, 28, 32, 34) dan 2 berlabel khusus (2, 43) sebagai pembanding. Dibaca cuplikan awal/akhir bagian identitas/kepala, dakwaan, fakta, fakta hukum/pertimbangan bila ada, amar, serta konteks istilah yang relevan; bukan klaim membaca setiap paragraf seluruh 19 dokumen. Pilihan baca ini sengaja memperluas ragam isi setelah sampling, bukan sampel kedua untuk menghitung prevalensi fitur. Contoh khusus tidak menjadi bukti bahwa fitur wajib untuk cakupan proyek tersedia.

## Apa yang langsung ada di XML

Seluruh 48 root `putusan` mempunyai sepuluh atribut yang sama: `id`, `url`, `klasifikasi`, `sub_klasifikasi`, `lembaga_peradilan`, `provinsi`, `status`, `amar`, `amar_lainnya`, `lama_hukuman`. Semua anak bagian pada sampel berupa teks tanpa anak elemen lebih dalam. Karena itu tersedia struktur **dokumen dan bagian**, belum struktur **terdakwa-perkara dan fakta**. Bentuk ini dapat diperiksa pada [contoh pencurian][s01], [kecelakaan][s12], dan [banyak terdakwa][s02]; daftar sampel lengkap membatasi klaim 48/48.

| Metadata | Kegunaan yang diusulkan | Batas bukti/risiko |
| --- | --- | --- |
| `id`, `url` | Penelusuran sumber kasus historis | Bukan fakta pembanding kasus baru. |
| `klasifikasi`, `sub_klasifikasi` | Petunjuk awal pengelompokan dan pemeriksaan cakupan | Tidak otomatis menjadi kategori input pengguna. Pada [s09] label subkategori keamanan negara, tetapi dakwaannya menyebut UU Narkotika; pada [s28] label penghinaan, tetapi dakwaan juga membahas narkotika. Ini perbedaan teks dan metadata yang diamati, bukan penetapan klasifikasi hukum pengganti. |
| `lembaga_peradilan`, `provinsi` | Konteks asal, opsional bila diketahui pada saat estimasi | Belum ada alasan menjadikannya wajib atau bobot kemiripan; daftar PN tidak membuktikan semua dokumen memenuhi lingkup tingkat pertama. |
| `status` | Metadata kasus historis | Seluruh sampel bernilai berkekuatan hukum tetap; tidak dipakai sebagai fakta kasus baru sebelum putusan. |
| `amar`, `amar_lainnya`, `lama_hukuman` | Hasil aktual/pengecekan hasil historis | Dilarang menjadi input estimasi. `amar_lainnya` kadang menyimpan teks hukuman panjang; [s16] bahkan bernilai `5-lima-bulan` sementara amar memuat 1 tahun 5 bulan. Jangan menganggapnya fitur kategori tindak pidana. |

Keberadaan tag berisi teks setelah `strip()` dihitung pada semua XML terpilih. **Angka berikut bukan ketersediaan fitur tervalidasi**, ketepatan segmentasi, atau jaminan bebas kebocoran target.

| Bagian | Semua sampel, n/48 | Label umum saja, n/26 |
| --- | ---: | ---: |
| `kepala_putusan` | 48/48 | 26/26 |
| `identitas` | 37/48 | 23/26 |
| `riwayat_penahanan` | 40/48 | 20/26 |
| `riwayat_perkara` | 47/48 | 25/26 |
| `riwayat_tuntutan` | 46/48 | 25/26 |
| `riwayat_dakwaan` | 48/48 | 26/26 |
| `fakta` | 46/48 | 26/26 |
| `fakta_hukum` | 24/48 | 13/26 |
| `pertimbangan_hukum` | 20/48 | 11/26 |
| `amar_putusan` | 48/48 | 26/26 |
| `penutup` | 46/48 | 24/26 |

Tag hilang tidak berarti informasinya hilang: pada [s26] identitas berada dalam `kepala_putusan`, tanpa elemen `identitas`. Sebaliknya `fakta` pada [s06] hanya memuat kalimat duplik, sedangkan `riwayat_dakwaan` lebih panjang dan sampai membahas kejadian yang terungkap di persidangan. Jadi keberadaan tag tidak sama dengan kelengkapan narasi.

## Inventaris kandidat input dari pembacaan langsung

Semua rekomendasi pada kolom terakhir adalah **inferensi untuk pembahasan**, belum pemilihan fitur final. Tidak menghitung frekuensi regex seolah-olah membuktikan ekstraksi fitur berhasil.

| Kandidat | Asal dan bukti observasi | Kesulitan/risiko | Usulan |
| --- | --- | --- | --- |
| Narasi kejadian/perbuatan | Dakwaan dan keterangan saksi/terdakwa: pengambilan kendaraan setelah pemberian obat [s01], dugaan penipuan pengurusan CPNS [s10], angsuran tidak disetorkan [s16], pembelian barang hasil pencurian [s32]. | Teks panjang, OCR, pengulangan versi dakwaan/saksi, dan campuran kesimpulan hakim. Narasi peristiwa yang dituduhkan bukan fakta bersalah yang telah diputus. | Inti minimal: ringkasan faktual yang sumber dan ketersediaannya sebelum putusan jelas. Tidak menyalin seluruh tag. |
| Pasal **dakwaan**, undang-undang, ayat, bentuk dakwaan | [s01] menyebut alternatif Pasal 365(1), 363(1) ke-3, dan 362; [s15] memuat Pasal 368/372/378 jo. 56; [s19] juga memiliki beberapa alternatif. | Daftar pasal dalam pertimbangan/amar mencerminkan pilihan hakim; pencocokan semua kata “pasal” akan turut mengambil KUHAP dan pasal rujukan. OCR dapat merusak angka atau menghilangkan rujukan. | Inti minimal bila dakwaan sudah diketahui: pertahankan daftar serta hubungan alternatif/primair/subsidair, jangan pilih otomatis pasal yang akhirnya terbukti. Kasus sebelum dakwaan butuh kontrak input tersendiri. |
| Kategori perbuatan menurut informasi awal | `sub_klasifikasi` tersedia langsung; narasi/dakwaan memberi konteks. Pada [s26] label penggelapan tetapi amar menyatakan penipuan dari dakwaan kedua; [s06] label penipuan tetapi amar menyatakan penggelapan. | Label historis tidak menjamin tersedia atau tepat bagi kasus baru; kategori yang diambil dari amar membocorkan keputusan. | Boleh kategori yang pengguna ketahui sebelum putusan, dengan definisi dan sumber jelas; jangan wajibkan salinan label metadata atau kategori tindak pidana terbukti. |
| Umur | Identitas [s12] menyebut 38 tahun; identitas [s14] menyebut 33 tahun; identitas juga dapat berada di kepala [s26]. | Umur saat kejadian, saat sidang, dan tanggal lahir perlu dibedakan. Pada [s10] teks 58 tahun dan tahun lahir 1983 tidak selaras dengan kepala putusan 2015; [s32] juga memuat pasangan umur/tahun yang tampak tidak selaras. Ini indikasi teks perlu verifikasi, bukan koreksi otomatis. | Opsional dengan waktu acuan dan status belum diketahui; tidak wajib dari bukti sekarang. |
| Jenis kelamin | Identitas [s12] laki-laki; kepala [s26] perempuan. | Perlu mengaitkan kepada terdakwa yang tepat; tidak boleh tersalah mengambil identitas korban/saksi. Ketersediaan bukan bukti manfaat estimasi. | Opsional; belum ada dasar wajib atau bobot. |
| Pekerjaan dan pendidikan | [s12] swasta dan SMA tamat; [s14] swasta dan SD; [s15] perangkat desa; [s16] identitas mantan karyawan, narasi peran penagih. | Pekerjaan generik berbeda dari peran dalam peristiwa; pendidikan tidak selalu disebut dalam cuplikan yang dibaca. Nilai tidak terstruktur, format tabel dapat menyatu. | Opsional terpisah; jangan menganggap pendidikan kosong berarti tidak berpendidikan. |
| Peran dan keterlibatan pihak lain | [s15] dakwaan bantuan dan pembagian uang; [s16] tugas penagih; [s34] pelaku bersama pihak yang diperiksa terpisah. | Menghubungkan aksi, barang, dan orang memerlukan pembacaan konteks. Istilah peran dalam amar adalah hasil penilaian. | Opsional bernilai tinggi untuk didiskusikan, tetapi ambil versi peristiwa/dakwaan sebelum putusan. |
| Korban dan akibat fisik | [s12] narasi kecelakaan dan keterangan medis luka; [s23] beberapa orang dalam rangkaian kecelakaan; [s03] narasi kematian. | Bedakan korban, saksi, orang dalam alternatif dakwaan, serta akibat menurut laporan awal/visum dari kesimpulan hakim. Klasifikasi “luka berat” dapat merupakan rumusan dakwaan. | Opsional: akibat dan jumlah korban hanya bila diketahui dan dapat dipetakan; tanpa identitas pribadi. |
| Kerugian/jumlah uang | [s01] narasi menyebut kerugian kendaraan dan telepon; [s19] nilai piutang/perusahaan; [s18] dakwaan dan keterangan menyebut angka berbeda. | Banyak uang bukan kerugian: pembayaran, keuntungan pelaku, nilai barang, pengembalian, denda, biaya perkara. Pada [s18] terlihat Rp250 juta dan Rp228 juta dalam konteks berbeda; satu regex nominal tidak menyelesaikannya. | Opsional dengan makna, mata uang, sumber dan ketidakpastian; jangan wajib atau otomatis menjumlahkan semua nominal. |
| Barang yang terlibat/barang bukti | Kendaraan/telepon [s01]; dokumen pembayaran/angsuran [s16, s19]; peralatan rumah [s32]. | Barang bukti dapat milik saksi, terkait perkara terpisah, atau hanya dokumen pendukung. Keputusan dirampas/dikembalikan berasal dari amar. | Opsional berupa jenis dan hubungan dengan peristiwa; status putusan atas barang dikeluarkan. |
| Kekerasan/senjata/cara melakukan | [s01] dugaan obat dalam minuman; [s34] narasi saksi memuat tembakan senjata api. | Keberadaan senjata dalam daftar barang tidak membuktikan terdakwa menggunakannya; harus tahu siapa melakukan apa. Tidak disebut bukan berarti tidak ada kekerasan. | Opsional dan dapat bernilai belum diketahui; bedakan alat/cara, pelaku, serta akibatnya. |
| Riwayat penghukuman | Keterangan terdakwa dalam `fakta` [s01] menyebut pernah dihukum; [s12] menyebut belum pernah dihukum. Pada [s34] keterangan ini terlihat dalam daftar memberatkan hakim. | Mengambil dari memberatkan saja memakai sintesis hakim. Beberapa perbuatan dalam perkara yang sama bukan otomatis riwayat penghukuman sebelumnya. Tidak disebut tidak membuktikan belum pernah. | Opsional hanya bila sumber sebelum putusan tersedia; pisahkan pernah, secara eksplisit belum pernah, dan belum diketahui. |

## Batas sebelum putusan dan contoh kebocoran target

Kontrak waktu yang dipakai untuk usulan minimal ialah **dakwaan dan fakta yang relevan sudah diketahui, hasil putusan belum diketahui**. Ini asumsi operasional untuk dibahas di keputusan #12. Catatan ini tidak menyatakan seluruh pernyataan dalam putusan historis sudah tersedia pada waktu itu.

1. **`fakta` dapat memuat durasi yang dijatuhkan.** Pada [s09], akhir `fakta` memuat pembuktian unsur, keadaan memberatkan/meringankan, lalu amar penjara lima tahun; `amar_putusan` justru dimulai dengan penetapan pengurangan penahanan. Menghapus elemen `amar_putusan` saja masih meninggalkan target dalam input. Pada [s10] `fakta` memuat kesimpulan terbukti dan pertimbangan hakim. Contoh s09 juga memperlihatkan label umum tidak cukup membuktikan masuk cakupan proyek.
2. **`fakta_hukum` adalah sintesis pengadilan dan dapat menyatu dengan pertimbangan.** Pada [s16] bagian ini berakhir dengan keadaan memberatkan/meringankan dan pasal yang dipakai; pada [s26] mencakup penilaian sebelum menjatuhkan pidana. Informasi peristiwa yang muncul di situ hanya layak diambil kembali bila ada sumber pra-putusan yang dapat dipisahkan, bukan karena nama tag mengandung “fakta”.
3. **`riwayat_dakwaan` juga perlu diperiksa.** Pada [s26] bagian ini sampai memuat putusan sela atas eksepsi, sehingga isinya melampaui uraian dakwaan awal. Pembanding di luar cakupan [s43], berlabel `pidana-khusus`, memuat penilaian unsur, tuntutan penjara delapan tahun, pembelaan, dan pertimbangan penjatuhan pidana dalam tag dakwaan. Ini bukti batas segmentasi dapat gagal, bukan alasan memakai kasus khusus sebagai dasar fitur wajib pidana umum.
4. **Pasal didakwakan berbeda dari pasal terbukti.** [s01] mengajukan tiga alternatif; hakim kemudian memilih salah satunya. [s03] amar membebaskan dari dakwaan kesatu primair sekaligus menjatuhkan penjara atas tindak pidana lain yang dinyatakan terbukti. Memakai pasal terpilih atau kategori terbukti sebagai input kasus baru akan memakai informasi setelah keputusan.

Karena itu usulan ini mengecualikan hasil aktual, durasi/denda tuntutan, amar, pasal terbukti, keputusan atas barang bukti, penilaian bersalah, dan daftar memberatkan/meringankan yang dirumuskan hakim sebagai sumber input langsung. Sifat peristiwa yang kebetulan disebut sebagai memberatkan hanya boleh dipertimbangkan sebagai input tersendiri jika benar-benar diketahui sebelum putusan; label evaluasi hakimnya tidak ikut.

## Usulan minimal dan hal yang masih diputuskan

**Inferensi untuk pembahasan:** mulai dari ringkasan kejadian yang dipastikan pra-putusan dan pasal dakwaan lengkap bila tersedia dalam skenario penggunaan. Konteks korban/akibat, nilai kerugian, peran, barang/cara/senjata, umur, pekerjaan, pendidikan, jenis kelamin, dan riwayat penghukuman adalah kandidat opsional; riset ini belum membuktikan urutan prioritas, kelengkapan seluruh korpus, atau manfaat masing-masing untuk CBR. Tidak ada dasar menjadikan semua kandidat kolom wajib.

Sebelum memasukkan satu kasus historis, tetap perlu memastikan cakupan pidana umum tingkat pertama, unit **satu terdakwa-perkara**, hubungan hasil aktual kepada unit itu, dan fakta aman yang dapat dipisahkan. [s02] memperlihatkan dokumen dua terdakwa dengan satu metadata hasil di root; jangan menganggap satu XML selalu satu unit kasus. Label umum yang bertentangan dengan isi atau klasifikasi yang meragukan perlu ditinjau atau dilewati, bukan direklasifikasi otomatis berdasarkan catatan ini. Kasus dengan pemetaan terdakwa/hasil ambigu atau kebocoran yang tidak dapat dipisahkan dilewati. Ini belum membuktikan berapa kasus seluruh korpus akan lolos.

Nilai **hilang/tidak disebut**, **belum diketahui sebelum putusan**, **secara eksplisit tidak ada**, dan **dibantah/tidak terbukti menurut putusan** mempunyai arti berbeda. Tidak ada tag `identitas` bukan bukti umur hilang; tidak ada kata senjata bukan bukti tanpa senjata; tidak disebut pernah dihukum bukan bukti belum pernah. Tidak terbukti merupakan hasil penilaian pengadilan, bukan pengganti nilai negatif pra-putusan.

Target proyek tetap **lama hukuman penjara dalam hari**, terpisah dari input. [Artikel primer bagian 4.3](https://www.mdpi.com/2073-431X/11/6/88) menggunakan 30 hari/bulan dan 360 hari/tahun. Pada [s01], amar 2 tahun 3 bulan sesuai metadata 810 hari; [s12], 4 bulan sesuai 120 hari. Ini pemeriksaan contoh, bukan validasi label seluruh sampel/korpus. Jangan mengurangkan masa tahanan atau menambahkan pidana pengganti denda sebagai lama penjara utama. Penetapan aturan konversi dan penanganan hasil ambigu masih perlu keputusan tersendiri.

Belum dilakukan preprocessing, pemilihan model/similarity, pengujian akurasi ekstraksi, validasi PDF, atau audit korpus. Hasil ini cukup untuk menyusun pilihan input yang konkret dalam #12; belum menetapkan pilihan pengguna.

## Lampiran: manifest path sampel

Urutan adalah peringkat digest. Semua path berada di `dataset/` pada commit yang dipatok di atas; `U` berarti metadata `pidana-umum`, `K` berarti `pidana-khusus`. `Baca` menandai 19 pembacaan cuplikan semantik; semua 48 diparse dan metadata/bagiannya dihitung. Tautan primer berikut menunjuk byte sumber publik, tanpa menerbitkan ulang identitas orang atau paragraf putusan.

| No. | Path XML | Label | Baca |
| ---: | --- | :---: | :---: |
| 1 | [d564bd860be0448a5527cc6f9a19abcf.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/d564bd860be0448a5527cc6f9a19abcf.xml) | U | ya |
| 2 | [3e982481bb531aace3640907a919af05.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/3e982481bb531aace3640907a919af05.xml) | K | ya |
| 3 | [13748477236945779313b460af96db3d.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/13748477236945779313b460af96db3d.xml) | U | ya |
| 4 | [0aab3f6bfac632f340a5a8f3167259d1.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/0aab3f6bfac632f340a5a8f3167259d1.xml) | K |  |
| 5 | [6f277c7b686a17ef7ab303e687e11d2f.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/6f277c7b686a17ef7ab303e687e11d2f.xml) | U | ya |
| 6 | [4186683e75b95b69d02748287c211050.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/4186683e75b95b69d02748287c211050.xml) | U | ya |
| 7 | [40dfc6225b7598beedb6bba5869b44b8.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/40dfc6225b7598beedb6bba5869b44b8.xml) | K |  |
| 8 | [1cd5bdd02aaf8a3cb0c82233671fba41.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/1cd5bdd02aaf8a3cb0c82233671fba41.xml) | K |  |
| 9 | [2d5a7c31e0b7a36e8661ace5b9c0758b.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/2d5a7c31e0b7a36e8661ace5b9c0758b.xml) | U | ya |
| 10 | [af196d420a2f1c5114fd063dd0ef117b.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/af196d420a2f1c5114fd063dd0ef117b.xml) | U | ya |
| 11 | [78290d17484d99bc30f6ef82fa7da8c5.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/78290d17484d99bc30f6ef82fa7da8c5.xml) | K |  |
| 12 | [384486ee8c876d408fa1d0457d2567b4.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/384486ee8c876d408fa1d0457d2567b4.xml) | U | ya |
| 13 | [8676469e6d245c71981c497520fa6fd1.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/8676469e6d245c71981c497520fa6fd1.xml) | K |  |
| 14 | [191e61703793829869d2835b219cc31e.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/191e61703793829869d2835b219cc31e.xml) | U | ya |
| 15 | [439a907e93d1f61f99c4c29ce7d1921d.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/439a907e93d1f61f99c4c29ce7d1921d.xml) | U | ya |
| 16 | [894e9c025b9e21b318107e204a2d484e.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/894e9c025b9e21b318107e204a2d484e.xml) | U | ya |
| 17 | [b5613ca3f03f0ee98fe99d3358148917.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/b5613ca3f03f0ee98fe99d3358148917.xml) | K |  |
| 18 | [f070dc46e7c1f1f1150725ab86afb2e5.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/f070dc46e7c1f1f1150725ab86afb2e5.xml) | U | ya |
| 19 | [6ac496ec6ab130d2756b98a8f5ba15a1.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/6ac496ec6ab130d2756b98a8f5ba15a1.xml) | U | ya |
| 20 | [e8a1ce51882bf3e239aa6465700eb15f.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/e8a1ce51882bf3e239aa6465700eb15f.xml) | K |  |
| 21 | [647f72a8111bc2e43f55372b12c845b3.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/647f72a8111bc2e43f55372b12c845b3.xml) | K |  |
| 22 | [44998d88820c8e2ec2ce6993e4c604d3.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/44998d88820c8e2ec2ce6993e4c604d3.xml) | K |  |
| 23 | [592ed87ceb82685c029c99688aa48e54.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/592ed87ceb82685c029c99688aa48e54.xml) | U | ya |
| 24 | [32e73e1dbf371367212d6339ef914d07.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/32e73e1dbf371367212d6339ef914d07.xml) | U |  |
| 25 | [88c221defd367f037cdbe87064788ca8.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/88c221defd367f037cdbe87064788ca8.xml) | K |  |
| 26 | [195dae3fa815dbb439b587133deb82b9.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/195dae3fa815dbb439b587133deb82b9.xml) | U | ya |
| 27 | [6d43523768ede3ee40b6b7149341b84c.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/6d43523768ede3ee40b6b7149341b84c.xml) | K |  |
| 28 | [7a43cc0b56c6ac5180fe5d4ba736491b.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/7a43cc0b56c6ac5180fe5d4ba736491b.xml) | U | ya |
| 29 | [262279915ace44e095a8490dd61d94c1.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/262279915ace44e095a8490dd61d94c1.xml) | U |  |
| 30 | [1a8c85884d24b346b13a04b4b6daed70.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/1a8c85884d24b346b13a04b4b6daed70.xml) | K |  |
| 31 | [1b2ed766658b1a3676599f91e28c7432.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/1b2ed766658b1a3676599f91e28c7432.xml) | K |  |
| 32 | [6e59b63a80f1e436f9cdb56bc7bf162c.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/6e59b63a80f1e436f9cdb56bc7bf162c.xml) | U | ya |
| 33 | [213eb96c23357a98b17bcd0eb1cffc9c.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/213eb96c23357a98b17bcd0eb1cffc9c.xml) | U |  |
| 34 | [8bd68198decaec8e3e0a2d730e5c1876.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/8bd68198decaec8e3e0a2d730e5c1876.xml) | U | ya |
| 35 | [ecd9b95994fc121a6978eb4331b1eab8.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/ecd9b95994fc121a6978eb4331b1eab8.xml) | K |  |
| 36 | [ee7f3dd91685f577d41e886a71805046.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/ee7f3dd91685f577d41e886a71805046.xml) | U |  |
| 37 | [3a4a8049390d62a66735a6ff1224a1b8.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/3a4a8049390d62a66735a6ff1224a1b8.xml) | U |  |
| 38 | [e3cd25dcbf7d638f12ac91bf1d0fe4c2.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/e3cd25dcbf7d638f12ac91bf1d0fe4c2.xml) | K |  |
| 39 | [15773daca55da996220ba70d5902973a.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/15773daca55da996220ba70d5902973a.xml) | K |  |
| 40 | [74f72c86f5dea81a6671d09ffca97831.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/74f72c86f5dea81a6671d09ffca97831.xml) | K |  |
| 41 | [21ed888ec61f81cb7eb19bba8075bfd2.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/21ed888ec61f81cb7eb19bba8075bfd2.xml) | U |  |
| 42 | [88a586e73e5c0429dc89213ac15d8775.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/88a586e73e5c0429dc89213ac15d8775.xml) | K |  |
| 43 | [127e39cc80d269f02673994778e99cde.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/127e39cc80d269f02673994778e99cde.xml) | K | ya |
| 44 | [3ca4bbf2dc4a98b94c0ce9cee3fa3dd6.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/3ca4bbf2dc4a98b94c0ce9cee3fa3dd6.xml) | K |  |
| 45 | [ee6c542d898c5bb0d25248026b4800c1.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/ee6c542d898c5bb0d25248026b4800c1.xml) | K |  |
| 46 | [533b4b2c4e044c4237d55ff881cd3010.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/533b4b2c4e044c4237d55ff881cd3010.xml) | U |  |
| 47 | [f284538fba86533afec80ff2e19ec93f.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/f284538fba86533afec80ff2e19ec93f.xml) | U |  |
| 48 | [dc5cb5314b4d70a97da25d07d8818aac.xml](https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/dc5cb5314b4d70a97da25d07d8818aac.xml) | U |  |

[s01]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/d564bd860be0448a5527cc6f9a19abcf.xml
[s02]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/3e982481bb531aace3640907a919af05.xml
[s03]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/13748477236945779313b460af96db3d.xml
[s06]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/4186683e75b95b69d02748287c211050.xml
[s09]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/2d5a7c31e0b7a36e8661ace5b9c0758b.xml
[s10]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/af196d420a2f1c5114fd063dd0ef117b.xml
[s12]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/384486ee8c876d408fa1d0457d2567b4.xml
[s14]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/191e61703793829869d2835b219cc31e.xml
[s15]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/439a907e93d1f61f99c4c29ce7d1921d.xml
[s16]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/894e9c025b9e21b318107e204a2d484e.xml
[s18]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/f070dc46e7c1f1f1150725ab86afb2e5.xml
[s19]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/6ac496ec6ab130d2756b98a8f5ba15a1.xml
[s23]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/592ed87ceb82685c029c99688aa48e54.xml
[s26]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/195dae3fa815dbb439b587133deb82b9.xml
[s28]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/7a43cc0b56c6ac5180fe5d4ba736491b.xml
[s32]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/6e59b63a80f1e436f9cdb56bc7bf162c.xml
[s34]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/8bd68198decaec8e3e0a2d730e5c1876.xml
[s43]: https://github.com/ir-nlp-csui/indo-law/blob/67340338adbc63021630947d905627eef0d7e43f/dataset/127e39cc80d269f02673994778e99cde.xml
