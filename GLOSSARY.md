# Estimasi Lama Hukuman Pidana

Istilah domain untuk aplikasi tugas kuliah estimasi lama hukuman pidana berdasarkan pengalaman putusan pengadilan di Indonesia.

## Language

**Lama hukuman**:
Durasi pidana penjara yang dijatuhkan dalam putusan. Istilah ini tidak berarti sisa masa tahanan atau waktu aktual sampai seseorang bebas.

**Unit kasus**:
Satu terdakwa dalam satu perkara, dengan fakta perkara dan satu hasil aktual yang dapat dihubungkan secara jelas kepada terdakwa tersebut. Satu dokumen putusan dapat memuat lebih dari satu unit kasus.

**Kelompok perkara**:
Kumpulan unit kasus dari perkara yang sama, salinan putusan, atau perkara terkait yang hubungannya diketahui. Kesamaan kategori perbuatan saja tidak menjadikan dua kasus bagian dari satu kelompok perkara.

**Kategori perbuatan**:
Pengelompokan perbuatan berdasarkan informasi yang diketahui sebelum putusan. Kategori perbuatan dibedakan dari tindak pidana yang akhirnya dinyatakan terbukti oleh hakim.

**Kasus baru**:
Perkara yang fakta relevannya sudah tersedia, tetapi putusannya belum diketahui dalam skenario estimasi.

**Kasus historis**:
Pengalaman perkara terdahulu yang memiliki informasi perkara dan hasil putusan sebagai sumber pengetahuan.

**Pembagian evaluasi**:
Pembagian unit kasus ke bagian training, validasi, dan test dengan seed serta proporsi yang dicatat. Seluruh anggota satu kelompok perkara berada pada bagian yang sama.

**Estimasi ditahan**:
Keadaan ketika mesin tidak menghasilkan angka estimasi karena syarat kelayakan tidak terpenuhi. Alasan penahanan disertakan; nol atau tebakan tidak dipakai sebagai pengganti.

**Cakupan estimasi**:
Proporsi unit layak yang memperoleh angka estimasi. Unit tanpa hasil aktual positif yang diketahui tidak masuk penyebut.

**Pembanding median**:
Nilai median hasil aktual training secara keseluruhan atau per kategori yang dipakai sebagai pembanding sederhana. Kategori yang tidak ditemukan di training memakai median keseluruhan.

**Basis kasus (case base)**:
Kumpulan kasus historis yang menjadi sumber pengalaman untuk penalaran berbasis kasus.

**Kasus referensi**:
Kasus historis yang digunakan sebagai rujukan dalam menghasilkan estimasi untuk kasus baru.

**Estimasi lama hukuman**:
Perkiraan durasi pidana penjara berdasarkan pola putusan historis dan kemiripan kasus. Estimasi bukan putusan aktual atau penentuan hukuman yang seharusnya diberikan.

**Hasil aktual**:
Lama hukuman yang tercantum sebagai hasil putusan suatu kasus dalam dataset atau yang dimasukkan pengguna sebagai hasil putusan yang telah diketahui. Hasil aktual dibedakan dari estimasi lama hukuman.

**Retrieve**:
Tahap pencarian dan pemilihan kasus historis yang memiliki kemiripan fakta dengan kasus baru sebagai kasus referensi.

**Reuse**:
Tahap menghasilkan estimasi lama hukuman untuk kasus baru berdasarkan hasil aktual kasus referensi yang dipilih melalui Retrieve.

**Revise**:
Tahap penyesuaian hasil penyelesaian kasus baru menggunakan hasil aktual setelah estimasi dihasilkan melalui Reuse.

**Retain**:
Tahap penambahan kasus baru beserta hasil aktualnya ke basis kasus sebagai pengalaman untuk estimasi berikutnya.

**Narasi fakta perkara**:
Uraian kejadian dan keterlibatan terdakwa berdasarkan informasi yang diketahui sebelum putusan. Narasi dibedakan dari penilaian hakim dan hasil putusan; uraian peristiwa yang dituduhkan tidak berarti kesalahan terdakwa telah diputus.

**Pasal dakwaan**:
Ketentuan hukum yang didakwakan kepada terdakwa, termasuk susunan alternatif atau subsidair jika ada. Pasal dakwaan dibedakan dari pasal yang akhirnya dinyatakan terbukti dalam putusan.

**Kebocoran target**:
Penggunaan informasi yang mengungkap lama hukuman atau hasil putusan, secara langsung maupun tidak langsung, atau yang belum tersedia pada saat estimasi kasus baru. Keberadaan informasi dalam bagian fakta putusan historis tidak menjamin informasi tersebut layak menjadi fitur estimasi.
