export interface XmlOptions {
  id: string;
  courtSlug?: string;
  classification?: string;
  subClassification?: string;
  sentence?: string;
  amar?: string;
  amarOther?: string;
  url?: string;
  status?: string;
  sections?: Record<string, string>;
}

const DEFAULT_SECTIONS: Record<string, string> = {
  kepala_putusan:
    'putusan nomor 12 pid b 2024 pn contoh demi keadilan berdasarkan ketuhanan yang maha esa pengadilan negeri contoh yang mengadili perkara pidana dalam tingkat pertama menjatuhkan putusan sebagai berikut dalam perkara terdakwa',
  identitas:
    'nama lengkap budi bin ahmad tempat lahir contoh umur tanggal lahir 30 tahun 10 maret 1994 jenis kelamin laki laki kebangsaan indonesia tempat tinggal jalan contoh agama islam pekerjaan swasta pendidikan sma tamat terdakwa ditahan dalam tahanan negara oleh penyidik sejak tanggal 20 mei 2024',
  riwayat_perkara:
    'setelah membaca surat surat dalam berkas perkara setelah mendengar dakwaan yang dibacakan penuntut umum',
  riwayat_dakwaan:
    'bahwa ia terdakwa budi bin ahmad pada hari senin tanggal 13 mei 2024 sekitar jam 20 00 wib bertempat di jalan contoh kota contoh mengambil satu unit sepeda motor milik saksi korban dengan maksud untuk memiliki secara melawan hukum perbuatan terdakwa sebagaimana diatur dan diancam pidana dalam pasal 362 kuhp',
  fakta:
    'menimbang bahwa di persidangan telah diperiksa keterangan saksi dan terdakwa menyatakan belum pernah dihukum',
  amar_putusan:
    'menyatakan terdakwa budi bin ahmad terbukti secara sah dan meyakinkan bersalah melakukan tindak pidana pencurian menjatuhkan pidana kepada terdakwa dengan pidana penjara selama 6 enam bulan menetapkan masa penangkapan dan penahanan yang telah dijalani terdakwa dikurangkan seluruhnya dari pidana yang dijatuhkan',
  penutup: 'demikianlah diputus dalam permusyawaratan majelis hakim',
};

export function xmlDocument(options: XmlOptions): string {
  const sections = { ...DEFAULT_SECTIONS, ...(options.sections ?? {}) };
  const attributes: Record<string, string> = {
    amar: options.amar ?? 'pidana',
    amar_lainnya: options.amarOther ?? 'hukum',
    id: options.id,
    klasifikasi: options.classification ?? 'pidana-umum',
    lama_hukuman: options.sentence ?? '180',
    lembaga_peradilan: options.courtSlug ?? 'pn-contoh',
    provinsi: 'jabar',
    status: options.status ?? 'berkekuatan-hukum-tetap',
    sub_klasifikasi: options.subClassification ?? 'pencurian',
    url:
      options.url ??
      `https://putusan3.mahkamahagung.go.id/direktori/putusan/${options.id}.html`,
  };

  const attributesText = Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');
  const sectionsText = Object.entries(sections)
    .map(([tag, text]) => `<${tag}>\n${text}\n</${tag}>`)
    .join('\n');

  return `<putusan ${attributesText}>\n${sectionsText}\n</putusan>\n`;
}

export const singleDefendant = xmlDocument({ id: 'doc-single' });

export const singleDefendantCopy = singleDefendant;

export const formatCopy = singleDefendant
  .replace(/\n/g, '\n\n')
  .replace(/>\s+</g, '>\n   <');

export const alternativeArticles = xmlDocument({
  id: 'doc-alternative',
  subClassification: 'penggelapan',
  sentence: '360',
  sections: {
    kepala_putusan:
      'putusan nomor 21 pid b 2024 pn contoh demi keadilan berdasarkan ketuhanan yang maha esa pengadilan negeri contoh yang mengadili perkara pidana dalam tingkat pertama menjatuhkan putusan sebagai berikut dalam perkara terdakwa',
    identitas:
      'nama lengkap sinta binti hasan tempat lahir contoh umur tanggal lahir 28 tahun 2 februari 1996 jenis kelamin perempuan kebangsaan indonesia tempat tinggal jalan contoh agama islam pekerjaan karyawan pendidikan sma tamat terdakwa ditahan sejak tanggal 2 juni 2024',
    riwayat_dakwaan:
      'bahwa ia terdakwa sinta binti hasan pada hari selasa tanggal 4 juni 2024 bertempat di kantor contoh memiliki uang perusahaan yang berada dalam kekuasaannya perbuatan terdakwa sebagaimana diatur dan diancam pidana dalam dakwaan kesatu pasal 372 kuhp atau kedua bahwa ia terdakwa pada waktu yang sama melakukan perbuatan penipuan sebagaimana diatur dan diancam pidana dalam pasal 378 kuhp',
    fakta:
      'menimbang bahwa keterangan saksi menerangkan terdakwa mengakui perbuatannya dan terdakwa belum pernah dihukum',
    amar_putusan:
      'menyatakan terdakwa sinta binti hasan terbukti bersalah melakukan tindak pidana penggelapan menjatuhkan pidana kepada terdakwa dengan pidana penjara selama 1 satu tahun',
  },
});

export const multiDefendant = xmlDocument({
  id: 'doc-multi',
  sentence: '360',
  sections: {
    kepala_putusan:
      'putusan nomor 31 pid b 2024 pn contoh demi keadilan berdasarkan ketuhanan yang maha esa pengadilan negeri contoh yang mengadili perkara pidana dalam tingkat pertama menjatuhkan putusan sebagai berikut dalam perkara para terdakwa',
    identitas:
      'terdakwa i nama lengkap andi bin saputra umur tanggal lahir 25 tahun 1 januari 1999 jenis kelamin laki laki pekerjaan swasta terdakwa ii nama lengkap bayu bin saputra umur tanggal lahir 30 tahun 2 februari 1994 jenis kelamin laki laki pekerjaan swasta',
    riwayat_dakwaan:
      'bahwa ia terdakwa 1 andi bin saputra dan terdakwa 2 bayu bin saputra pada hari senin tanggal 3 juni 2024 mengambil sepeda motor milik korban sebagaimana diatur dan diancam pidana dalam pasal 362 kuhp',
    amar_putusan:
      'menyatakan terdakwa andi bin saputra dan terdakwa bayu bin saputra terbukti bersalah menjatuhkan pidana kepada terdakwa andi bin saputra dengan pidana penjara selama 1 satu tahun dan kepada terdakwa bayu bin saputra dengan pidana penjara selama 2 dua tahun',
  },
});

export const leakyNarrative = xmlDocument({
  id: 'doc-leaky',
  sections: {
    riwayat_dakwaan:
      'bahwa ia terdakwa budi bin ahmad pada hari senin tanggal 13 mei 2024 mengambil sepeda motor milik korban dan kemudian berdasarkan putusan pengadilan terdakwa dijatuhi hukuman 2 tahun penjara perbuatan tersebut sebagaimana diatur dalam pasal 362 kuhp',
    fakta: 'menimbang bahwa keterangan saksi menerangkan perbuatan terdakwa',
    amar_putusan:
      'menyatakan terdakwa budi bin ahmad terbukti bersalah menjatuhkan pidana dengan pidana penjara selama 6 enam bulan',
  },
});

export const conflictCopyA = xmlDocument({
  id: 'doc-conflict-a',
  sections: {
    riwayat_dakwaan:
      'bahwa ia terdakwa budi bin ahmad pada hari senin tanggal 13 mei 2024 mengambil sepeda motor milik korban sebagaimana diatur dan diancam pidana dalam pasal 362 kuhp dengan kronologi yang berbeda dari salinan lain',
    amar_putusan:
      'menyatakan terdakwa budi bin ahmad terbukti bersalah menjatuhkan pidana dengan pidana penjara selama 6 enam bulan',
  },
  sentence: '180',
});

export const conflictCopyB = xmlDocument({
  id: 'doc-conflict-b',
  sections: {
    riwayat_dakwaan:
      'bahwa ia terdakwa budi bin ahmad pada hari senin tanggal 13 mei 2024 mengambil sepeda motor milik korban sebagaimana diatur dan diancam pidana dalam pasal 362 kuhp dengan kronologi salinan kedua yang berbeda',
    amar_putusan:
      'menyatakan terdakwa budi bin ahmad terbukti bersalah menjatuhkan pidana dengan pidana penjara selama 1 satu tahun',
  },
  sentence: '360',
});

export const zeroOutcome = xmlDocument({
  id: 'doc-zero',
  sentence: '0',
  amar: 'bebas',
  sections: {
    riwayat_dakwaan:
      'bahwa ia terdakwa budi bin ahmad pada hari senin tanggal 13 mei 2024 mengambil sepeda motor milik korban sebagaimana diatur dan diancam pidana dalam pasal 362 kuhp',
    amar_putusan: 'menyatakan terdakwa tidak terbukti bersalah dan membebaskan terdakwa',
  },
});

export const outcomeConflict = xmlDocument({
  id: 'doc-outcome-conflict',
  sentence: '180',
  sections: {
    riwayat_dakwaan:
      'bahwa ia terdakwa budi bin ahmad pada hari senin tanggal 13 mei 2024 mengambil sepeda motor milik korban sebagaimana diatur dan diancam pidana dalam pasal 362 kuhp',
    amar_putusan:
      'menyatakan terdakwa budi bin ahmad terbukti bersalah menjatuhkan pidana dengan pidana penjara selama 2 dua tahun',
  },
});

export const specialLaw = xmlDocument({
  id: 'doc-special',
  subClassification: 'pencurian',
  sections: {
    riwayat_dakwaan:
      'bahwa ia terdakwa budi bin ahmad pada hari senin tanggal 13 mei 2024 menawarkan untuk menjual narkotika golongan i sebagaimana diatur dan diancam pidana dalam pasal 114 ayat 1 uu no 35 tahun 2009 tentang narkotika',
    amar_putusan:
      'menyatakan terdakwa budi bin ahmad terbukti bersalah menjatuhkan pidana dengan pidana penjara selama 5 lima tahun',
  },
  sentence: '1800',
});

export const malformed = '<putusan><kepala_putusan>tidak tertutup';

export const relatedA = xmlDocument({
  id: 'doc-related-a',
  sections: {
    kepala_putusan:
      'putusan nomor 22 pid b 2024 pn contoh demi keadilan berdasarkan ketuhanan yang maha esa pengadilan negeri contoh yang mengadili perkara pidana dalam tingkat pertama menjatuhkan putusan sebagai berikut dalam perkara terdakwa',
    riwayat_perkara:
      'setelah membaca berkas perkara ini yang terkait dengan perkara lain nomor 23 pid b 2024 pn contoh',
    riwayat_dakwaan:
      'bahwa ia terdakwa budi bin ahmad pada hari senin tanggal 13 mei 2024 mengambil sepeda motor milik korban sebagaimana diatur dan diancam pidana dalam pasal 362 kuhp',
  },
});

export const relatedB = xmlDocument({
  id: 'doc-related-b',
  sections: {
    kepala_putusan:
      'putusan nomor 23 pid b 2024 pn contoh demi keadilan berdasarkan ketuhanan yang maha esa pengadilan negeri contoh yang mengadili perkara pidana dalam tingkat pertama menjatuhkan putusan sebagai berikut dalam perkara terdakwa',
    riwayat_perkara:
      'setelah membaca berkas perkara ini yang terkait dengan perkara lain nomor 22 pid b 2024 pn contoh',
    identitas:
      'nama lengkap cici binti dahlan tempat lahir contoh umur tanggal lahir 35 tahun 3 maret 1989 jenis kelamin perempuan kebangsaan indonesia tempat tinggal jalan contoh agama islam pekerjaan wiraswasta',
    riwayat_dakwaan:
      'bahwa ia terdakwa cici binti dahlan pada hari senin tanggal 13 mei 2024 mengambil sepeda motor milik korban sebagaimana diatur dan diancam pidana dalam pasal 362 kuhp',
  },
});

export const unknownCategory = xmlDocument({
  id: 'doc-unknown-category',
  subClassification: 'kategori-baru',
  sections: {
    kepala_putusan:
      'putusan nomor 41 pid b 2024 pn contoh demi keadilan berdasarkan ketuhanan yang maha esa pengadilan negeri contoh yang mengadili perkara pidana dalam tingkat pertama menjatuhkan putusan sebagai berikut dalam perkara terdakwa',
  },
});

export const contradictoryCategory = xmlDocument({
  id: 'doc-contradictory-category',
  subClassification: 'pencurian',
  sections: {
    kepala_putusan:
      'putusan nomor 42 pid b 2024 pn contoh demi keadilan berdasarkan ketuhanan yang maha esa pengadilan negeri contoh yang mengadili perkara pidana dalam tingkat pertama menjatuhkan putusan sebagai berikut dalam perkara terdakwa',
    riwayat_dakwaan:
      'bahwa ia terdakwa budi bin ahmad pada hari senin tanggal 13 mei 2024 membujuk korban menyerahkan uang dengan tipu muslihat sebagaimana diatur dan diancam pidana dalam pasal 378 kuhp',
    amar_putusan:
      'menyatakan terdakwa budi bin ahmad terbukti bersalah menjatuhkan pidana dengan pidana penjara selama 6 enam bulan',
  },
});

export const metadataOnly = xmlDocument({
  id: 'doc-metadata-only',
  sentence: '240',
  sections: {
    riwayat_dakwaan:
      'bahwa ia terdakwa budi bin ahmad pada hari senin tanggal 13 mei 2024 mengambil sepeda motor milik korban sebagaimana diatur dan diancam pidana dalam pasal 362 kuhp',
    amar_putusan:
      'menetapkan masa penangkapan dan penahanan yang telah dijalani terdakwa dikurangkan seluruhnya dari pidana yang dijatuhkan dan memerintahkan terdakwa tetap ditahan',
  },
});

export const ageWithoutReference = xmlDocument({
  id: 'doc-age-no-reference',
  sections: {
    identitas:
      'nama lengkap budi bin ahmad tempat lahir contoh umur tanggal lahir 30 tahun 10 maret 1994 jenis kelamin laki laki pekerjaan swasta',
    riwayat_dakwaan:
      'bahwa ia terdakwa budi bin ahmad pada hari senin tanggal 13 mei 2024 mengambil sepeda motor milik korban sebagaimana diatur dan diancam pidana dalam pasal 362 kuhp',
  },
});
