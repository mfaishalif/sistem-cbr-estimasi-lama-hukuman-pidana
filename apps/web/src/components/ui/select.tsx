import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldClass } from './input';

/** Native select for keyboard and screen-reader behaviour, styled to match fields. */
function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(fieldClass, 'h-11 appearance-none pr-10', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
        aria-hidden
      />
    </div>
  );
}

export { Select };
