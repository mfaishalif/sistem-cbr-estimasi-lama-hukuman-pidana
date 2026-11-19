import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cn } from '@/lib/utils';

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  ariaLabelledBy?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

// Radix treats "" as "nothing selected", so the "Belum diketahui" option ("")
// is mapped to a sentinel while inside the primitive.
const UNKNOWN = '__unknown__';
const toInner = (value: string) => (value === '' ? UNKNOWN : value);
const toOuter = (value: string) => (value === UNKNOWN ? '' : value);

/** Single-choice segmented control. Clicking the active item keeps it selected. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabelledBy,
  ariaLabel,
  disabled,
  className,
}: SegmentedProps<T>) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={toInner(value)}
      onValueChange={(next) => {
        if (next !== '') onChange(toOuter(next) as T);
      }}
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
      disabled={disabled}
      // 1px border + 2px padding + 38px item = 44px, the same height as inputs.
      className={cn('inline-flex min-h-11 w-fit max-w-full flex-wrap items-center rounded-md border border-rule-strong bg-surface p-0.5', className)}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={toInner(option.value)}
          value={toInner(option.value)}
          className="h-[38px] rounded-sm px-3 text-sm text-ink-muted transition-colors hover:text-ink data-[state=on]:bg-ink data-[state=on]:text-paper disabled:cursor-not-allowed"
        >
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}
