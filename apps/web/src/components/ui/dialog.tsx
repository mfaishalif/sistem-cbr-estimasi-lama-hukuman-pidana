import type { ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
}

/** Centered confirmation dialog; actions are passed as children. */
export function ConfirmDialog({ open, onOpenChange, title, description, children }: ConfirmDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-ink/40" />
        <DialogPrimitive.Content
          role="alertdialog"
          className="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md bg-surface p-6 outline-none"
        >
          <DialogPrimitive.Title className="font-serif text-xl font-semibold text-ink">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-[15px] text-ink-muted">{description}</DialogPrimitive.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-3">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const DialogClose = DialogPrimitive.Close;
