import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import type { ReferenceDetail } from '@/lib/api';
import { copy } from '@/lib/copy';
import { formatSentence, formatSentenceApprox } from '@/lib/duration';
import { formatPercent } from '@/lib/format';
import { MAX_RADIUS, buildScale, labelAlign, layoutDots } from '@/lib/range';
import { cn } from '@/lib/utils';

interface SentenceRangeProps {
  references: ReferenceDetail[];
  estimateDays: number;
  actualDays: number | null;
  activeRank: number | null;
  onActiveRankChange: (rank: number | null) => void;
  onSelect: (rank: number) => void;
  explanation: string | null;
}

const LABEL_ROW = 24;
const LANE_STEP = MAX_RADIUS * 2 + 4;
const EDGE = MAX_RADIUS + 1;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const update = () => setWidth(element.clientWidth || 560);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

function MarkerLabel({ percent, top, className, children }: { percent: number; top: number; className: string; children: string }) {
  const align = labelAlign(percent);
  const shift = align === 'start' ? '0' : align === 'end' ? '-100%' : '-50%';
  return (
    <span
      className={cn('tabular absolute whitespace-nowrap text-[13px] font-medium', className)}
      style={{ left: `${percent}%`, top, transform: `translateX(${shift})` }}
    >
      {children}
    </span>
  );
}

export function SentenceRange({ references, estimateDays, actualDays, activeRank, onActiveRankChange, onSelect, explanation }: SentenceRangeProps) {
  const { ref, width } = useWidth();
  const scale = useMemo(
    () => buildScale([...references.map((reference) => reference.actualSentenceDays), estimateDays, ...(actualDays === null ? [] : [actualDays])]),
    [references, estimateDays, actualDays],
  );
  const dots = useMemo(
    () =>
      layoutDots(
        references.map((reference) => ({ rank: reference.rank, days: reference.actualSentenceDays, weightShare: reference.reuse.weightShare })),
        scale,
        width,
      ),
    [references, scale, width],
  );

  const lanes = Math.max(1, ...dots.map((dot) => dot.lane + 1));
  const plotTop = LABEL_ROW + 8;
  const axisY = plotTop + (lanes - 1) * LANE_STEP + MAX_RADIUS;
  const tickY = axisY + MAX_RADIUS + 8;
  const actualY = tickY + 24;
  const height = actualDays === null ? tickY + 20 : actualY + 22;

  const values = references.map((reference) => reference.actualSentenceDays);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const summary = `${copy.result.rangeTitle}: ${references.length} putusan, ${
    low === high ? formatSentence(low) : `${formatSentence(low)} sampai ${formatSentence(high)}`
  }. Estimasi ${formatSentenceApprox(estimateDays)}.${actualDays === null ? '' : ` Putusan aktual ${formatSentence(actualDays)}.`}`;
  const byRank = new Map(references.map((reference) => [reference.rank, reference]));

  return (
    <figure className="space-y-4">
      <figcaption className="text-[15px] font-semibold text-ink">{copy.result.rangeTitle}</figcaption>

      <div className="px-[20px]">
        <div ref={ref} role="group" aria-label={summary} className="relative" style={{ height }}>
          <div className="absolute inset-x-0 h-px bg-rule-strong" style={{ top: axisY }} />
          {scale.ticks.map((tick) => (
            <div key={tick.months}>
              <span className="absolute h-1.5 w-px bg-rule-strong" style={{ left: `${tick.percent}%`, top: axisY }} />
              <span
                className="tabular absolute -translate-x-1/2 whitespace-nowrap text-[13px] text-ink-subtle"
                style={{ left: `${tick.percent}%`, top: tickY }}
                aria-hidden
              >
                {tick.label}
              </span>
            </div>
          ))}

          <span
            className="absolute w-0.5 -translate-x-1/2 bg-accent"
            style={{ left: `${scale.percent(estimateDays)}%`, top: LABEL_ROW, height: axisY + EDGE - LABEL_ROW }}
            aria-hidden
          />
          <MarkerLabel percent={scale.percent(estimateDays)} top={0} className="text-accent">
            {`Estimasi ${formatSentenceApprox(estimateDays)}`}
          </MarkerLabel>

          {actualDays === null ? null : (
            <>
              <span
                className="absolute -translate-x-1/2 border-l-2 border-dashed border-ink"
                style={{ left: `${scale.percent(actualDays)}%`, top: plotTop, height: actualY - plotTop }}
                aria-hidden
              />
              <MarkerLabel percent={scale.percent(actualDays)} top={actualY} className="text-ink">
                {`Putusan aktual ${formatSentence(actualDays)}`}
              </MarkerLabel>
            </>
          )}

          {dots.map((dot) => {
            const reference = byRank.get(dot.rank);
            const label = `Putusan #${dot.rank}: hukuman ${formatSentence(dot.days)}, tingkat kemiripan ${formatPercent(reference?.score ?? 0)}, pengaruh ${formatPercent(dot.weightShare)}`;
            return (
              <Tooltip key={dot.rank} content={label}>
                <button
                  type="button"
                  aria-label={label}
                  onMouseEnter={() => onActiveRankChange(dot.rank)}
                  onMouseLeave={() => onActiveRankChange(null)}
                  onFocus={() => onActiveRankChange(dot.rank)}
                  onBlur={() => onActiveRankChange(null)}
                  onClick={() => onSelect(dot.rank)}
                  className={cn(
                    'tabular absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[12px] font-semibold text-white transition-shadow',
                    "before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
                    dot.rank === 1 ? 'bg-accent' : 'bg-ink',
                    activeRank === dot.rank ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : 'ring-2 ring-surface',
                  )}
                  style={{
                    left: `${dot.percent}%`,
                    top: axisY - dot.lane * LANE_STEP,
                    width: dot.radius * 2,
                    height: dot.radius * 2,
                    zIndex: activeRank === dot.rank ? 3 : 2,
                  }}
                >
                  {dot.rank}
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {explanation === null ? null : <p className="text-[15px] text-ink-muted">{explanation}</p>}
    </figure>
  );
}
