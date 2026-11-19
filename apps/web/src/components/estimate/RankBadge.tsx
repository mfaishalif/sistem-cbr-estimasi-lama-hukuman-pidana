import { cn } from '@/lib/utils';

/** The numbered circle shared by the chart and the ruling list. Rank 1 is maroon. */
export function RankBadge({ rank, className }: { rank: number; className?: string }) {
  return (
    <span
      className={cn(
        'tabular inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white',
        rank === 1 ? 'bg-accent' : 'bg-ink',
        className,
      )}
      aria-hidden
    >
      {rank}
    </span>
  );
}
