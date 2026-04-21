import type { Metadata } from 'next'
import { AlertTriangle, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Account Suspended — GH Hostels',
}

export default function MaintenancePage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-surface-sunken px-6">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/10 ring-1 ring-warning/20">
          <AlertTriangle className="h-8 w-8 text-warning" strokeWidth={1.5} />
        </div>

        {/* Heading */}
        <h1 className="mt-6 font-display text-2xl font-bold text-text-primary tracking-tight">
          Account suspended
        </h1>

        {/* Body */}
        <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-sm mx-auto">
          This hostel&apos;s account has been temporarily suspended.
          If you&apos;re the owner, this is usually because your trial has
          ended or there&apos;s an outstanding balance.
        </p>

        {/* Actions */}
        <div className="mt-8 space-y-3">
          <a
            href="mailto:support@gh-hostels.com?subject=Account%20Suspended"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-fg shadow-sm transition-colors hover:bg-brand-hover"
          >
            <Mail className="h-4 w-4" />
            Contact support
          </a>

          <a
            href="https://gh-hostels.com"
            className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-surface px-5 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Go to GH Hostels
          </a>
        </div>

        {/* Footer hint */}
        <p className="mt-10 text-xs text-text-tertiary">
          If you believe this is an error, reach out to{' '}
          <a href="mailto:support@gh-hostels.com" className="text-brand hover:underline">
            support@gh-hostels.com
          </a>
        </p>
      </div>
    </div>
  )
}
