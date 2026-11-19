import type { ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Wider sheet for forms. */
  wide?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

/** Side drawer built on Radix Dialog: focus is trapped and Escape closes it. */
export function Sheet({ open, onOpenChange, title, description, wide = false, children, footer }: SheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/30" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-paper outline-none',
            wide ? 'max-w-3xl' : 'max-w-xl',
          )}
          {...(description === undefined ? { 'aria-describedby': undefined } : {})}
        >
          <div className="flex items-start justify-between gap-4 px-4 pb-4 pt-6 sm:px-8">
            <div className="min-w-0">
              <DialogPrimitive.Title className="font-serif text-2xl font-semibold text-ink">{title}</DialogPrimitive.Title>
              {description === undefined ? null : (
                <DialogPrimitive.Description className="mt-1 text-sm text-ink-subtle">{description}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
              aria-label="Tutup"
            >
              <X className="size-5" aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 sm:px-8">{children}</div>
          {footer === undefined ? null : (
            <div className="border-t border-rule bg-paper px-4 py-4 sm:px-8">{footer}</div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
