import type { EstimateResult } from './api';

export function formatDays(days: number | null | undefined): string {
  if (days === null || days === undefined) {
    return '—';
  }
  return `${days.toLocaleString('id-ID')} hari`;
}

export function formatNumber(value: number, digits = 3): string {
  return value.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;
}

export function actualRange(result: EstimateResult): { low: number; high: number } | null {
  if (result.references.length === 0) {
    return null;
  }
  const values = result.references.map((reference) => reference.actualSentenceDays);
  return { low: Math.min(...values), high: Math.max(...values) };
}

export function estimateHeadline(result: EstimateResult): string {
  if (result.status === 'estimated' && result.estimate.days !== null) {
    return `Estimasi ${formatDays(result.estimate.days)} dari ${result.references.length} kasus referensi.`;
  }
  return 'Estimasi ditahan.';
}

export function rangeHeadline(result: EstimateResult): string | null {
  const range = actualRange(result);
  if (range === null) {
    return null;
  }
  if (range.low === range.high) {
    return `Hasil aktual referensi ${formatDays(range.low)}.`;
  }
  return `Hasil aktual referensi ${formatDays(range.low)}–${formatDays(range.high)}.`;
}

/**
 * User-facing wording follows the uncertainty decision: wording is chosen from
 * the engine's withholding code, and the estimated duration stays empty.
 */
export function withholdingMessage(result: EstimateResult): string {
  if (result.withholding === null) {
    return '';
  }
  const { code, details } = result.withholding;
  const selected =
    typeof details?.selectedCount === 'number'
      ? details.selectedCount
      : result.references.length;

  switch (code) {
    case 'NARASI_KOSONG':
    case 'NARASI_TIDAK_TERBANDING':
      return 'Narasi belum dapat dibandingkan. Tambahkan uraian kejadian berdasarkan fakta yang sudah diketahui.';
    case 'BASIS_KASUS_KOSONG':
      return 'Basis kasus belum berisi kasus historis dengan hasil aktual. Tambahkan atau impor kasus terlebih dahulu.';
    case 'TIDAK_ADA_REFERENSI_KATEGORI':
      return 'Belum cukup kasus serupa untuk membuat estimasi. Kategori yang dipilih belum memiliki kasus historis yang memenuhi syarat; pencarian tidak diperluas diam-diam ke kategori lain.';
    case 'REFERENSI_TIDAK_CUKUP': {
      const rejectedScore =
        typeof details?.rejectedBelowScore === 'number' ? details.rejectedBelowScore : 0;
      const rejectedCoverage =
        typeof details?.rejectedCoverage === 'number' ? details.rejectedCoverage : 0;
      const filters: string[] = [];
      if (rejectedScore > 0) {
        filters.push(`${rejectedScore} kandidat di bawah ambang skor`);
      }
      if (rejectedCoverage > 0) {
        filters.push(`${rejectedCoverage} kandidat di bawah ambang cakupan atribut`);
      }
      return `Belum cukup kasus serupa untuk membuat estimasi. ${selected} kasus referensi memenuhi syarat${
        filters.length > 0 ? `; ${filters.join(' dan ')}` : ''
      }. Fakta tidak perlu diubah.`;
    }
    case 'BOBOT_NOL':
      return 'Estimasi tidak dapat dihitung karena jumlah bobot referensi nol.';
    case 'INDEKS_BELUM_SIAP':
      return 'Indeks basis kasus belum siap. Estimasi ditahan sampai indeks selesai dibangun.';
    case 'INDEKS_GAGAL_DIBANGUN':
      return 'Indeks basis kasus gagal dibangun. Estimasi ditahan; periksa status indeks dan data kasus.';
    default:
      return result.withholding.message;
  }
}

export function indexStatusLabel(status: string): string {
  switch (status) {
    case 'ready':
      return 'Siap';
    case 'building':
      return 'Sedang dibangun';
    case 'stale':
      return 'Perlu dibangun ulang';
    case 'failed':
      return 'Gagal';
    default:
      return status;
  }
}
