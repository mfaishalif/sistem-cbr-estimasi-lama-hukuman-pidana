import * as React from 'react';
import { cn } from '@/lib/utils';

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label data-slot="label" className={cn('block text-[15px] font-medium text-ink', className)} {...props} />
  );
}

function Hint({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-[13px] leading-snug text-ink-subtle', className)} {...props} />;
}

function FieldMessage({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm font-medium text-danger', className)} {...props} />;
}

export { Label, Hint, FieldMessage };
