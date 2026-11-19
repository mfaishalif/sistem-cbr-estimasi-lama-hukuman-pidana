import { copy } from '@/lib/copy';

/** Five rulings on a line; radius suggests influence, the maroon one is the most similar. */
const DOTS = [
  { x: 118, r: 11, top: false },
  { x: 196, r: 19, top: true },
  { x: 262, r: 9, top: false },
  { x: 338, r: 15, top: false },
  { x: 412, r: 12, top: false },
];
const WIDTH = 520;
const AXIS_Y = 120;
const ESTIMATE_X = 286;

/**
 * Static, simplified picture of the Estimasi range chart. An example, not
 * data: no axis, no numbers besides the estimate label, no legend. The label
 * is HTML so it keeps a readable size when the SVG scales down on phones.
 */
export function HeroIllustration() {
  return (
    <figure className="space-y-3">
      <div className="rounded-md bg-surface px-4 py-8 sm:px-8" aria-hidden="true">
        <div className="relative pt-8">
          <span
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[13px] font-medium text-accent sm:text-[15px]"
            style={{ left: `${(ESTIMATE_X / WIDTH) * 100}%` }}
          >
            {copy.landing.illustrationLabel}
          </span>
          <svg viewBox={`0 0 ${WIDTH} 170`} className="h-auto w-full" focusable="false">
            <line x1="40" x2="480" y1={AXIS_Y} y2={AXIS_Y} className="stroke-rule-strong" strokeWidth="1.5" />
            <line x1={ESTIMATE_X} x2={ESTIMATE_X} y1="18" y2={AXIS_Y + 30} className="stroke-accent" strokeWidth="2.5" />
            {DOTS.map((dot) => (
              <circle
                key={dot.x}
                cx={dot.x}
                cy={AXIS_Y}
                r={dot.r}
                className={dot.top ? 'fill-accent stroke-surface' : 'fill-ink stroke-surface'}
                strokeWidth="3"
              />
            ))}
          </svg>
        </div>
      </div>
      <p className="sr-only">{copy.landing.illustrationAlt}</p>
      <figcaption className="text-[13px] text-ink-subtle">{copy.landing.illustrationCaption}</figcaption>
    </figure>
  );
}
