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
      className={cn('inline-flex max-w-full flex-wrap rounded-md border border-rule-strong bg-surface p-0.5', className)}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={toInner(option.value)}
          value={toInner(option.value)}
          className="min-h-10 rounded-sm px-3 text-sm text-ink-muted transition-colors hover:text-ink data-[state=on]:bg-ink data-[state=on]:text-paper disabled:cursor-not-allowed"
        >
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}
