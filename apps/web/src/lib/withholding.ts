import type { EstimateResult } from './api';
import { formatInteger } from './format';
import { categoryPhrase } from './vocabulary';

/**
 * Plain-language explanation for a withheld estimate. The raw code is only
 * shown in "Rincian perhitungan"; here every code maps to what happened and
 * what the user can do next.
 */
export type WithholdingAction = 'search-all-categories' | 'edit-narration' | 'retry' | 'open-cases' | null;

export interface WithholdingCopy {
  body: string;
  action: WithholdingAction;
  actionLabel: string | null;
}

const actionLabels: Record<Exclude<WithholdingAction, null>, string> = {
  'search-all-categories': 'Cari di semua kategori',
  'edit-narration': 'Ubah kronologi',
  retry: 'Hitung ulang',
  'open-cases': 'Buka Basis kasus',
};

function make(body: string, action: WithholdingAction): WithholdingCopy {
  return { body, action, actionLabel: action === null ? null : actionLabels[action] };
}

export function withholdingCopy(result: EstimateResult): WithholdingCopy | null {
  if (result.withholding === null) return null;
  const { code, details } = result.withholding;
  const restricted = result.category.restriction === 'same-category';
  const category = categoryPhrase(result.category.requested);
  const found =
    typeof details?.selectedCount === 'number' ? details.selectedCount : result.references.length;
  const needed = result.scoring.minReferences;

  switch (code) {
    case 'NARASI_KOSONG':
      return make('Kronologi masih kosong. Tulis uraian kejadian sebelum putusan.', 'edit-narration');
    case 'NARASI_TIDAK_TERBANDING':
      return make('Kronologi belum memuat kata yang dikenali. Tambahkan uraian kejadian.', 'edit-narration');
    case 'BASIS_KASUS_KOSONG':
      return make(
        'Basis kasus belum berisi putusan dengan hukuman yang tercatat. Tambahkan perkara beserta putusannya, atau impor data Indo-Law.',
        'open-cases',
      );
    case 'TIDAK_ADA_REFERENSI_KATEGORI':
      return make(
        `Belum ada putusan${category === null ? ' dalam kategori ini' : ` dalam kategori ${category}`}. Pilih "Belum diketahui" agar pencarian mencakup semua kategori.`,
        'search-all-categories',
      );
    case 'REFERENSI_TIDAK_CUKUP': {
      const counts = `Ditemukan ${formatInteger(found)} dari minimal ${formatInteger(needed)} putusan serupa.`;
      return restricted
        ? make(
            `Putusan serupa dalam kategori ini terlalu sedikit. ${counts} Coba pilih "Belum diketahui" agar pencarian mencakup semua kategori.`,
            'search-all-categories',
          )
        : make(
            `Putusan yang cukup mirip terlalu sedikit. ${counts} Uraikan kejadian lebih rinci agar lebih banyak putusan dapat dibandingkan.`,
            'edit-narration',
          );
    }
    case 'BOBOT_NOL':
      return make(
        'Putusan ditemukan, tetapi tingkat kemiripannya nol sehingga tidak dapat ditimbang. Uraikan kejadian lebih rinci.',
        'edit-narration',
      );
    case 'INDEKS_BELUM_SIAP':
      return make('Indeks basis kasus sedang disiapkan. Tunggu sebentar, lalu hitung ulang.', 'retry');
    case 'INDEKS_GAGAL_DIBANGUN':
      return make(
        'Indeks basis kasus gagal disiapkan. Mulai ulang aplikasi atau periksa data di Basis kasus, lalu hitung ulang.',
        'retry',
      );
    default:
      return make(result.withholding.message, null);
  }
}
