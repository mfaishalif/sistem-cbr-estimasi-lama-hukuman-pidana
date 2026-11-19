import type { ComponentProps } from 'react';
import { Check } from 'lucide-react';
import type { Option } from '@/lib/vocabulary';
import { humanizeSlug } from '@/lib/vocabulary';
import { cn } from '@/lib/utils';

/** Static chip for summaries (filled details). */
export function Chip({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn('inline-flex items-center rounded-sm bg-surface-sunken px-2 py-0.5 text-[13px] text-ink-muted', className)}
      {...props}
    />
  );
}

interface ChipSelectProps {
  options: readonly Option[];
  value: string[];
  onChange: (value: string[]) => void;
  labelledBy: string;
  disabled?: boolean;
}

/**
 * Multi-select chips with `aria-pressed`. Values stored in the case base that
 * are not in `options` stay visible (and selected) so editing never drops them.
 */
export function ChipSelect({ options, value, onChange, labelledBy, disabled }: ChipSelectProps) {
  const extra = value
    .filter((item) => !options.some((option) => option.value === item))
    .map((item) => ({ value: item, label: humanizeSlug(item) }));
  const all = [...options, ...extra];
  const toggle = (item: string) =>
    onChange(value.includes(item) ? value.filter((entry) => entry !== item) : [...value, item]);

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {all.map((option) => {
        const pressed = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            onClick={() => toggle(option.value)}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors sm:min-h-9',
              pressed
                ? 'border-ink bg-ink text-paper'
                : 'border-rule-strong bg-surface text-ink-muted hover:text-ink',
              'disabled:cursor-not-allowed disabled:opacity-55',
            )}
          >
            {pressed ? <Check className="size-3.5" aria-hidden /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
