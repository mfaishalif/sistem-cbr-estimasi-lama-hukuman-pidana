import * as React from 'react';
import { cn } from '@/lib/utils';
import { fieldClass } from './input';

/** Grows with its content; `rows` is the minimum height. */
function Textarea({ className, value, rows = 8, ...props }: React.ComponentProps<'textarea'>) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight + 2}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      rows={rows}
      value={value}
      className={cn(fieldClass, 'resize-none overflow-hidden py-3 leading-relaxed', className)}
      {...props}
    />
  );
}

export { Textarea };
