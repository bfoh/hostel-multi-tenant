import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:    'bg-surface-raised text-text-secondary border border-border',
        brand:      'bg-brand-subtle text-brand border border-brand/20',
        success:    'bg-success-subtle text-success',
        danger:     'bg-danger-subtle text-danger',
        warning:    'bg-warning-subtle text-warning-fg',
        info:       'bg-info-subtle text-info',
        accent:     'bg-accent-subtle text-accent-hover',
        // Booking-specific statuses
        confirmed:  'bg-success-subtle text-success',
        pending:    'bg-warning-subtle text-warning-fg',
        cancelled:  'bg-danger-subtle text-danger',
        checked_in: 'bg-brand-subtle text-brand',
        checked_out:'bg-surface-raised text-text-secondary border border-border',
        // Housekeeping statuses
        clean:      'bg-success-subtle text-success',
        dirty:      'bg-danger-subtle text-danger',
        inspecting: 'bg-info-subtle text-info',
        out_of_order: 'bg-warning-subtle text-warning-fg',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
