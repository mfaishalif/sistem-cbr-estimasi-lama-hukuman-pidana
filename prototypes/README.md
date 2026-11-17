# Prototipe alur estimasi hingga Revise dan Retain

Artefak diskusi untuk [Tentukan alur antarmuka estimasi hingga Revise dan Retain](https://github.com/mfaishalif/sistem-cbr-estimasi-lama-hukuman-pidana/issues/11), pada [Peta pengembangan aplikasi tugas kuliah estimasi lama hukuman pidana berbasis CBR](https://github.com/mfaishalif/sistem-cbr-estimasi-lama-hukuman-pidana/issues/2).

**Status: alur disetujui pengguna pada 18 November 2026. Daftar input dan metode masih terbuka. Bukan implementasi final.**

Buka `4r-flow.prototype.html` dengan klik dua kali. Tidak ada instalasi, server, koneksi jaringan, atau penyimpanan permanen. Muat ulang halaman untuk reset.

## Pertanyaan

Apakah alur ini membantu mahasiswa memasukkan fakta satu terdakwa–perkara, membandingkan kasus referensi dan estimasi, lalu menggunakan hasil aktual untuk Revise dan Retain tanpa mencampurkan estimasi dengan hasil putusan?

## Usulan yang dapat dicoba

- Navigasi **Kasus baru** dan **Basis kasus**.
- Fakta sebelum putusan → Retrieve → perbandingan referensi → Reuse.
- Estimasi awal tetap terlihat setelah hasil aktual diisi.
- Simpan hasil aktual → Revise → Retain sebagai tindakan yang berbeda agar empat tahap CBR dapat ditunjukkan.
- Sebelum aktual diketahui, Retain belum tersedia. Retain ulang tidak menambah salinan.
- Basis kasus menyediakan tambah, lihat, ubah, dan hapus tanpa verifikasi tambahan atau riwayat perubahan. Koreksi memengaruhi Retrieve berikutnya; hasil estimasi yang sedang ditampilkan tetap memakai referensi saat dihitung.
- Kasus baru dan Reset demo tersedia untuk mengulangi alur. Empat skenario terpandu dan tombol jelajah bebas menunjukkan perubahan keadaan kasus kerja.

Seluruh contoh adalah data fiktif. Penanda perkara, terdakwa, dan teks fakta hanya cukup untuk menguji alur; ini tidak mengunci representasi fakta atau rancangan database. Skor dan urutan referensi disimulasikan. Rata-rata durasi referensi hanya ilustrasi agar perubahan alur bisa dilihat, bukan metode Retrieve–Reuse yang telah dipilih. Tidak ada hasil eksperimen atau klaim akurasi.

## Tanggapan pengguna dan tindak lanjut

Pengguna menyatakan: "alur sudah oke, namun aku masih bingung apa saja input sistem". Alur diterima; ini tidak mengunci kolom fakta atau metode. Pertanyaan bentuk input (narasi, atribut terstruktur, atau gabungan), kolom wajib/opsional, dan informasi yang dipakai untuk kemiripan dilanjutkan pada [Tentukan representasi fakta perkara dan metode Retrieve–Reuse](https://github.com/mfaishalif/sistem-cbr-estimasi-lama-hukuman-pidana/issues/12). Resolusi alur dicatat pada tiket prototipe. Jangan menggabungkan HTML prototipe ke aplikasi produksi.
