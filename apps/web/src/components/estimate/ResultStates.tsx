import { Button } from '@/components/ui/button';
import type { IndexStatus } from '@/lib/api';
import { copy } from '@/lib/copy';

/** Static grey sketch of the range chart for the empty state. */
function RangeSketch() {
  const dots = [18, 34, 41, 63, 80];
  return (
    <div className="relative mt-10 h-16" aria-hidden>
      <div className="absolute inset-x-0 top-8 h-px bg-rule" />
      {dots.map((left, index) => (
        <span
          key={left}
          className="absolute top-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-sunken"
          style={{ left: `${left}%`, width: index === 2 ? 30 : 22, height: index === 2 ? 30 : 22 }}
        />
      ))}
      <span className="absolute left-[52%] top-1 h-10 w-px bg-rule-strong/50" />
      <div className="absolute inset-x-0 top-12 flex justify-between text-[13px] text-ink-subtle/70">
        <span>6 bln</span>
        <span>1 thn</span>
        <span>1 thn 6 bln</span>
      </div>
    </div>
  );
}

export function EmptyState() {
  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold text-ink">{copy.result.emptyTitle}</h2>
      <p className="mt-2 max-w-prose text-[15px] text-ink-muted">{copy.result.emptyBody}</p>
      <RangeSketch />
    </div>
  );
}

function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-sm bg-surface-sunken ${className}`} />;
}

/** Same shape as a successful result. */
export function LoadingState({ building }: { building: boolean }) {
  return (
    <div>
      <p className="text-sm text-ink-subtle">{building ? copy.index.building : copy.result.loading}</p>
      <Bar className="mt-4 h-12 w-52" />
      <Bar className="mt-3 h-4 w-72 max-w-full" />
      <Bar className="mt-10 h-3 w-48" />
      <Bar className="mt-4 h-20 w-full" />
      {[0, 1, 2].map((item) => (
        <div key={item} className="mt-8 space-y-2">
          <Bar className="h-5 w-40" />
          <Bar className="h-2 w-64 max-w-full" />
          <Bar className="h-14 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert">
      <h2 className="font-serif text-2xl font-semibold text-ink">{copy.result.errorTitle}</h2>
      <p className="mt-2 text-[15px] text-ink-muted">{message}</p>
      <p className="mt-1 text-sm text-ink-subtle">Periksa koneksi ke server aplikasi, lalu coba lagi.</p>
      <Button className="mt-6" onClick={onRetry}>
        {copy.result.retry}
      </Button>
    </div>
  );
}

/** Index conditions shown before the first estimate. A ready index needs no notice. */
export function IndexNotice({ index }: { index: IndexStatus | null }) {
  if (index === null || index.status === 'ready') return null;
  const text =
    index.status === 'building'
      ? 'Indeks basis kasus sedang disiapkan. Estimasi bisa dihitung setelah selesai, biasanya dalam beberapa detik.'
      : index.status === 'stale'
        ? 'Basis kasus berubah sejak indeks terakhir disiapkan. Indeks disiapkan ulang otomatis saat Anda menghitung estimasi, jadi hitungan pertama bisa lebih lama.'
        : `Indeks basis kasus gagal dimuat (${index.message}). Mulai ulang aplikasi atau periksa data di Basis kasus, lalu hitung lagi.`;
  return (
    <p className={`mb-8 rounded-md px-4 py-3 text-[15px] ${index.status === 'failed' ? 'bg-caution-soft text-caution' : 'bg-surface-sunken text-ink-muted'}`}>
      {text}
    </p>
  );
}
