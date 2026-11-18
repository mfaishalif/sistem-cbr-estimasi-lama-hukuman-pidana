import * as React from 'react';
import { cn } from '@/lib/utils';

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn('text-sm font-medium text-ink', className)}
      {...props}
    />
  );
}

function FieldHint({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-hint"
      className={cn('text-xs leading-relaxed text-ink-subtle', className)}
      {...props}
    />
  );
}

export { Label, FieldHint };
