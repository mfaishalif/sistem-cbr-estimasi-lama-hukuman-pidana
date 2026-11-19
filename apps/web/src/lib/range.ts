import { DAYS_PER_MONTH, formatMonthsTick } from './duration';

/**
 * Pure layout for the "Rentang hukuman pada putusan serupa" chart. The axis is
 * in months (30 days); positions are percentages so the HTML chart can be
 * fluid, while dot collision uses the measured pixel width.
 */

export interface RangeScale {
  minMonths: number;
  maxMonths: number;
  ticks: Array<{ months: number; label: string; percent: number }>;
  /** Day value → 0–100 position along the axis. */
  percent: (days: number) => number;
}

const TICK_STEPS = [1, 2, 3, 6, 12, 24, 36, 60, 120, 240];
const MAX_TICKS = 6;

export function buildScale(days: readonly number[]): RangeScale {
  const months = days.filter((value) => Number.isFinite(value)).map((value) => value / DAYS_PER_MONTH);
  const low = months.length === 0 ? 0 : Math.min(...months);
  const high = months.length === 0 ? 12 : Math.max(...months);
  const span = high - low;
  const pad = span === 0 ? Math.max(2, high * 0.25) : Math.max(1, span * 0.12);
  const minMonths = Math.max(0, low - pad);
  const maxMonths = high + pad;
  const width = maxMonths - minMonths;

  const step =
    TICK_STEPS.find((candidate) => Math.floor(width / candidate) + 1 <= MAX_TICKS) ??
    TICK_STEPS[TICK_STEPS.length - 1]!;
  const toPercent = (value: number) => ((value - minMonths) / width) * 100;
  const ticks: RangeScale['ticks'] = [];
  for (let value = Math.ceil(minMonths / step) * step; value <= maxMonths + 1e-9; value += step) {
    ticks.push({ months: value, label: formatMonthsTick(value), percent: toPercent(value) });
  }

  return {
    minMonths,
    maxMonths,
    ticks,
    percent: (value: number) => toPercent(value / DAYS_PER_MONTH),
  };
}

export interface DotInput {
  rank: number;
  days: number;
  weightShare: number;
}

export interface DotLayout extends DotInput {
  percent: number;
  /** 0 = on the axis row; 1, 2, … stacked upwards. */
  lane: number;
  radius: number;
}

export const MIN_RADIUS = 11;
export const MAX_RADIUS = 19;

/** Area ∝ weight share, so a dot twice as influential looks twice as large. */
export function dotRadius(share: number, maxShare: number): number {
  if (!(maxShare > 0) || !(share > 0)) return MIN_RADIUS;
  const ratio = Math.sqrt(Math.min(1, share / maxShare));
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * ratio;
}

/**
 * Place dots by rank (rank 1 first, so it always sits on the axis) in the
 * lowest lane where it does not overlap an earlier dot. Equal sentences end up
 * stacked vertically instead of hiding each other.
 */
export function layoutDots(
  dots: readonly DotInput[],
  scale: RangeScale,
  widthPx: number,
  gapPx = 4,
): DotLayout[] {
  const maxShare = Math.max(0, ...dots.map((dot) => dot.weightShare));
  const placed: DotLayout[] = [];
  for (const dot of [...dots].sort((a, b) => a.rank - b.rank)) {
    const percent = scale.percent(dot.days);
    const radius = dotRadius(dot.weightShare, maxShare);
    const x = (percent / 100) * widthPx;
    let lane = 0;
    while (
      placed.some(
        (other) =>
          other.lane === lane &&
          Math.abs((other.percent / 100) * widthPx - x) < other.radius + radius + gapPx,
      )
    ) {
      lane += 1;
    }
    placed.push({ ...dot, percent, lane, radius });
  }
  return placed;
}

/** Keep marker labels inside the chart near its edges. */
export function labelAlign(percent: number): 'start' | 'center' | 'end' {
  if (percent < 18) return 'start';
  if (percent > 82) return 'end';
  return 'center';
}
