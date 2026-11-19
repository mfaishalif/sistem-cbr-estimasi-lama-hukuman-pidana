import * as React from 'react';
import { cn } from '@/lib/utils';

export const fieldClass =
  'w-full rounded-md border border-rule-strong bg-surface px-3 text-base text-ink placeholder:text-ink-subtle transition-colors focus-visible:border-focus disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-subtle aria-[invalid=true]:border-danger';

function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input data-slot="input" className={cn(fieldClass, 'h-11', className)} {...props} />;
}

export { Input };
