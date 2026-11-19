import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { FieldMessage, Hint, Label } from './label';

interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  /** For groups (segmented controls, chips) that are not a single input. */
  asGroup?: boolean;
  /** Visually hide the label (repeated rows); it stays available to screen readers. */
  hideLabel?: boolean;
  children: ReactNode;
}

/**
 * One layout for every input: label → control → hint → error, 6px apart.
 * Controls should set `aria-describedby={describedBy(id, …)}` and
 * `aria-invalid` so the hint and error are announced with the control.
 */
export function Field({ id, label, hint, error, className, asGroup = false, hideLabel = false, children }: FieldProps) {
  const labelClass = hideLabel ? 'sr-only' : undefined;
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {asGroup ? (
        <p id={`${id}-label`} className={cn('text-[15px] font-medium text-ink', labelClass)}>
          {label}
        </p>
      ) : (
        <Label htmlFor={id} className={labelClass}>
          {label}
        </Label>
      )}
      {children}
      {hint === undefined ? null : <Hint id={`${id}-hint`}>{hint}</Hint>}
      {error === undefined ? null : <FieldMessage id={`${id}-error`}>{error}</FieldMessage>}
    </div>
  );
}

export function describedBy(id: string, options: { hint?: boolean; error?: string }): string | undefined {
  const ids = [options.hint ? `${id}-hint` : null, options.error ? `${id}-error` : null].filter(
    (value): value is string => value !== null,
  );
  return ids.length === 0 ? undefined : ids.join(' ');
}
