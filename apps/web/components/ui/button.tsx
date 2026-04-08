import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // Base styles applied to every button
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md',
    'font-medium transition-colors duration-fast',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        // ── Primary — Volta Blue fill ────────────────────────────────
        primary:
          'bg-brand text-brand-fg hover:bg-brand-hover active:bg-brand-active',

        // ── Secondary — outlined ─────────────────────────────────────
        secondary:
          'border border-border bg-surface text-text-primary hover:bg-surface-raised active:bg-surface-sunken',

        // ── Ghost — no border ────────────────────────────────────────
        ghost:
          'text-text-secondary hover:bg-surface-raised hover:text-text-primary active:bg-surface-sunken',

        // ── Danger — Harmattan Red ───────────────────────────────────
        danger:
          'bg-danger text-danger-fg hover:bg-danger-hover active:bg-danger-hover/90',

        // ── Danger outline ───────────────────────────────────────────
        'danger-outline':
          'border border-danger text-danger bg-transparent hover:bg-danger-subtle active:bg-danger-subtle/80',

        // ── Accent — Kente Gold ──────────────────────────────────────
        accent:
          'bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-hover/90',

        // ── Link — plain text ────────────────────────────────────────
        link:
          'text-brand underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        xs:   'h-7  px-2.5 text-xs',
        sm:   'h-8  px-3   text-sm',
        md:   'h-9  px-4   text-sm',
        lg:   'h-10 px-5   text-base',
        // Housekeeping staff UI — large touch targets
        xl:   'h-14 px-6   text-base',
        // Icon-only variants (square)
        'icon-xs': 'h-7  w-7  p-0',
        'icon-sm': 'h-8  w-8  p-0',
        'icon-md': 'h-9  w-9  p-0',
        'icon-lg': 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** When true, renders as the child element (Radix Slot pattern) */
  asChild?: boolean
  /** Show a loading spinner and disable interaction */
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
