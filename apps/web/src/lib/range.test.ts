import { describe, expect, it } from 'vitest';
import { MAX_RADIUS, MIN_RADIUS, buildScale, dotRadius, labelAlign, layoutDots } from './range';

describe('buildScale', () => {
  it('pads the reference range and keeps the axis non-negative', () => {
    const scale = buildScale([180, 240, 360]);
    expect(scale.minMonths).toBeGreaterThanOrEqual(0);
    expect(scale.minMonths).toBeLessThan(6);
    expect(scale.maxMonths).toBeGreaterThan(12);
    expect(scale.percent(180)).toBeGreaterThan(0);
    expect(scale.percent(360)).toBeLessThan(100);
  });

  it('labels ticks in months and years', () => {
    const scale = buildScale([90, 720]);
    expect(scale.ticks.length).toBeGreaterThanOrEqual(2);
    expect(scale.ticks.length).toBeLessThanOrEqual(6);
    expect(scale.ticks.map((tick) => tick.label)).toContain('1 thn');
    for (const tick of scale.ticks) {
      expect(tick.percent).toBeGreaterThanOrEqual(0);
      expect(tick.percent).toBeLessThanOrEqual(100);
    }
  });

  it('handles a single value', () => {
    const scale = buildScale([240]);
    expect(scale.percent(240)).toBeCloseTo(50, 0);
  });
});

describe('dot layout', () => {
  it('scales radius by weight share', () => {
    expect(dotRadius(0.4, 0.4)).toBe(MAX_RADIUS);
    expect(dotRadius(0, 0.4)).toBe(MIN_RADIUS);
    expect(dotRadius(0.1, 0.4)).toBeGreaterThan(MIN_RADIUS);
  });

  it('stacks equal sentences in separate lanes and keeps rank 1 on the axis', () => {
    const scale = buildScale([240, 240, 600]);
    const dots = layoutDots(
      [
        { rank: 2, days: 240, weightShare: 0.3 },
        { rank: 1, days: 240, weightShare: 0.4 },
        { rank: 3, days: 600, weightShare: 0.3 },
      ],
      scale,
      600,
    );
    const byRank = new Map(dots.map((dot) => [dot.rank, dot]));
    expect(byRank.get(1)?.lane).toBe(0);
    expect(byRank.get(2)?.lane).toBe(1);
    expect(byRank.get(3)?.lane).toBe(0);
  });

  it('keeps marker labels inside the edges', () => {
    expect(labelAlign(5)).toBe('start');
    expect(labelAlign(50)).toBe('center');
    expect(labelAlign(95)).toBe('end');
  });
});
