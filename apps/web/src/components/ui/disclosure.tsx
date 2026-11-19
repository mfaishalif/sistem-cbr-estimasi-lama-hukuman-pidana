import type { ReactNode } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DisclosureProps {
  title: ReactNode;
  /** Shown next to the title, e.g. "2 terisi". */
  meta?: ReactNode;
  /** Shown under the trigger while closed, e.g. chips of filled values. */
  summary?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

/** A text row with a chevron, no box. */
export function Disclosure({
  title,
  meta,
  summary,
  open,
  onOpenChange,
  defaultOpen,
  className,
  children,
}: DisclosureProps) {
  return (
    <Collapsible.Root open={open} onOpenChange={onOpenChange} defaultOpen={defaultOpen} className={cn('group/disclosure', className)}>
      <Collapsible.Trigger className="flex min-h-11 w-full flex-wrap items-center gap-x-2 rounded-md text-left text-[15px] font-medium text-ink hover:text-accent">
        <ChevronDown
          className="size-4 shrink-0 -rotate-90 text-ink-subtle transition-transform group-data-[state=open]/disclosure:rotate-0"
          aria-hidden
        />
        <span>{title}</span>
        {meta === undefined ? null : <span className="w-full pl-6 text-sm font-normal text-ink-subtle sm:w-auto sm:pl-0">{meta}</span>}
      </Collapsible.Trigger>
      {summary === undefined ? null : (
        <div className="pl-6 group-data-[state=open]/disclosure:hidden">{summary}</div>
      )}
      <Collapsible.Content className="pt-4">{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}
