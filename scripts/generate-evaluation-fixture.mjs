#!/usr/bin/env node
/**
 * Generate a deterministic synthetic Indo-Law-shaped snapshot for the Docker
 * evaluation flow. The files are committed so the Docker fixture does not need
 * to run a generator; rerunning this script must reproduce them byte-for-byte.
 *
 * This is test data only. It is not derived from a real verdict.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UNIT_COUNT = 90;
const CATEGORIES = [
  {
    slug: 'pencurian',
    article: '362',
    action: 'mengambil satu unit sepeda motor milik korban',
    extra: 'dengan maksud untuk memiliki secara melawan hukum',
  },
  {
    slug: 'penggelapan',
    article: '372',
    action: 'memiliki uang perusahaan yang berada dalam kekuasaannya',
    extra: 'kerugian sebesar rp 5 000 000 yang timbul dari perbuatan tersebut',
  },
  {
    slug: 'penipuan',
    article: '378',
    action: 'membujuk korban agar menyerahkan uang kepadanya',
    extra: 'dengan tipu muslihat dan kerugian sebesar rp 7 500 000',
  },
];

const PLACES = [
  'pasar kota contoh',
  'jalan raya provinsi',
  'halaman rumah korban',
  'dalam sebuah toko',
  'terminal bus',
  'area parkir',
];
const MOMENTS = [
  'pada malam hari',
  'pada siang hari',
  'menjelang pagi',
  'saat hujan turun',
  'setelah matahari terbenam',
];
const MEANS = [
  'dengan sepeda motor',
  'dengan berjalan kaki',
  'dengan mobil pinjaman',
  'tanpa alat khusus',
  'dengan kunci duplikat',
];

function namePart(index) {
  const first = String.fromCharCode(97 + Math.floor(index / 26));
  const second = String.fromCharCode(97 + (index % 26));
  return `budi ${first}${second}`;
}

function monthWord(months) {
  const words = [
    '',
    'satu',
    'dua',
    'tiga',
    'empat',
    'lima',
    'enam',
    'tujuh',
    'delapan',
    'sembilan',
    'sepuluh',
    'sebelas',
    'dua belas',
  ];
  return words[months] ?? String(months);
}

function caseXml(index) {
  const category = CATEGORIES[index % CATEGORIES.length];
  const name = namePart(index);
  const caseNumber = index + 1;
  const deadline = 180 + (index % 13) * 30;
  const months = deadline / 30;
  const place = PLACES[index % PLACES.length];
  const moment = MOMENTS[index % MOMENTS.length];
  const means = MEANS[index % MEANS.length];
  const victimCount = 1 + (index % 3);
  const prior = index % 5 === 0 ? 'pernah dihukum' : 'belum pernah dihukum';
  const id = `synthetic-${String(caseNumber).padStart(3, '0')}`;

  const narration =
    `bahwa ia terdakwa ${name} pada hari senin tanggal 13 mei 2024 ${moment} ` +
    `bertempat di ${place} ${category.action} ${category.extra} ${means} ` +
    `terhadap korban sebanyak ${victimCount} orang sebagai pelaku dan perbuatan ` +
    `tersebut dilakukan dengan kesadaran penuh tanpa ancaman dari pihak lain`;

  const sections = {
    kepala_putusan:
      `putusan nomor ${caseNumber} pid b 2024 pn contoh demi keadilan berdasarkan ketuhanan yang maha esa ` +
      `pengadilan negeri contoh yang mengadili perkara pidana dalam tingkat pertama menjatuhkan putusan ` +
      `sebagai berikut dalam perkara terdakwa`,
    identitas:
      `nama lengkap ${name} umur tanggal lahir 30 tahun 10 maret 1994 jenis kelamin laki laki ` +
      `kebangsaan indonesia tempat tinggal jalan contoh agama islam pekerjaan swasta pendidikan sma tamat ` +
      `terdakwa ditahan sejak tanggal 20 mei 2024`,
    riwayat_perkara:
      'setelah membaca surat surat dalam berkas perkara setelah mendengar dakwaan yang dibacakan penuntut umum',
    riwayat_dakwaan: narration,
    fakta:
      `keterangan saksi menerangkan bahwa terdakwa ${prior} dan mengakui perbuatan yang dilakukan ` +
      `di hadapan penyidik serta menyesali akibat dari perbuatannya`,
    amar_putusan:
      `menyatakan terdakwa ${name} terbukti secara sah dan meyakinkan bersalah melakukan tindak pidana ` +
      `${category.slug} menjatuhkan pidana kepada terdakwa dengan pidana penjara selama ` +
      `${months} ${monthWord(months)} bulan menetapkan masa penangkapan dan penahanan yang telah ` +
      `dijalani terdakwa dikurangkan seluruhnya dari pidana yang dijatuhkan`,
    penutup: 'demikianlah diputus dalam permusyawaratan majelis hakim',
  };

  const attributes = {
    amar: 'pidana',
    amar_lainnya: 'hukum',
    id,
    klasifikasi: 'pidana-umum',
    lama_hukuman: String(deadline),
    lembaga_peradilan: 'pn-contoh',
    provinsi: 'jabar',
    status: 'berkekuatan-hukum-tetap',
    sub_klasifikasi: category.slug,
    url: `https://example.invalid/putusan/${id}`,
  };

  const attributeText = Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');
  const sectionsText = Object.entries(sections)
    .map(([tag, text]) => `<${tag}>\n${text}\n</${tag}>`)
    .join('\n');
  return `<putusan ${attributeText}>\n${sectionsText}\n</putusan>\n`;
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const fixtureRoot = join(repositoryRoot, 'fixtures', 'indo-law-synthetic');
const datasetRoot = join(fixtureRoot, 'dataset');
mkdirSync(datasetRoot, { recursive: true });

const files = [];
for (let index = 0; index < UNIT_COUNT; index += 1) {
  const fileName = `unit-${String(index + 1).padStart(3, '0')}.xml`;
  const content = caseXml(index);
  writeFileSync(join(datasetRoot, fileName), content, 'utf8');
  files.push({
    path: fileName,
    sha256: createHash('sha256').update(content, 'utf8').digest('hex'),
    bytes: Buffer.byteLength(content, 'utf8'),
  });
}

const manifest = {
  schemaVersion: 1,
  source: {
    repository: 'https://example.invalid/synthetic-indo-law-fixture',
    commit: 'a'.repeat(40),
    datasetTree: 'b'.repeat(40),
    archiveUrl: 'https://example.invalid/synthetic-indo-law-fixture.zip',
    archiveSha256: 'c'.repeat(64),
    archiveBytes: files.reduce((total, file) => total + file.bytes, 0),
    downloadedAt: '2026-11-18T00:00:00.000Z',
  },
  extraction: {
    datasetPath: 'dataset',
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.bytes, 0),
    files,
  },
};
writeFileSync(join(fixtureRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Generated ${files.length} synthetic verdicts in ${fixtureRoot}`);
