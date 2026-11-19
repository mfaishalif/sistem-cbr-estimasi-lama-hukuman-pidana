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
  children: ReactNode;
}

/**
 * Label → optional one-line hint → error → control, in the GOV.UK order so the
 * error is read before the control it describes. Controls should set
 * `aria-describedby={describedBy(id, …)}` and `aria-invalid`.
 */
export function Field({ id, label, hint, error, className, asGroup = false, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {asGroup ? (
        <p id={`${id}-label`} className="text-[15px] font-medium text-ink">
          {label}
        </p>
      ) : (
        <Label htmlFor={id}>{label}</Label>
      )}
      {hint === undefined ? null : <Hint id={`${id}-hint`}>{hint}</Hint>}
      {error === undefined ? null : <FieldMessage id={`${id}-error`}>{error}</FieldMessage>}
      {children}
    </div>
  );
}

export function describedBy(id: string, options: { hint?: boolean; error?: string }): string | undefined {
  const ids = [options.hint ? `${id}-hint` : null, options.error ? `${id}-error` : null].filter(
    (value): value is string => value !== null,
  );
  return ids.length === 0 ? undefined : ids.join(' ');
}
