import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared look for input, select and textarea: same border, radius, padding.
 * Placeholders are lighter than values (ink-subtle at 70%) so an example such
 * as "mis. 363" never reads as a filled-in value.
 */
export const fieldClass =
  'w-full rounded-md border border-rule-strong bg-surface px-3 text-base text-ink placeholder:text-ink-subtle/70 transition-colors focus-visible:border-focus disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-subtle aria-[invalid=true]:border-danger';

/** Native date input: same height and padding, calendar icon aligned with the text. */
const dateClass =
  '[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-datetime-edit]:p-0 [&::-webkit-date-and-time-value]:text-left';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(fieldClass, 'h-11', type === 'date' && dateClass, className)}
      {...props}
    />
  );
}

export { Input };
