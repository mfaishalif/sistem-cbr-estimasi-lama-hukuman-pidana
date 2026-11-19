import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * One maroon `primary` per view. Everything else is `secondary` (outline),
 * `ghost`/`link` (text), or `danger` for destructive confirmation.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:bg-accent-hover',
        secondary: 'border border-rule-strong bg-surface text-ink hover:bg-surface-sunken',
        ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
        danger: 'bg-danger text-white hover:bg-[#861a1a]',
        link: 'h-auto px-0 text-accent underline decoration-1 underline-offset-4 hover:text-accent-hover',
      },
      size: {
        default: 'h-11 px-5 text-[15px]',
        sm: 'h-11 px-3 text-sm sm:h-9',
        icon: 'size-11',
        inline: 'h-auto p-0 text-[15px]',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'default' },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
