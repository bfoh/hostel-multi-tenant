import Link from 'next/link'
import { headers } from 'next/headers'
import { Gift, Clock } from 'lucide-react'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Shows a soft-nudge when the tenant is on the trial clock.
 * Hidden once they have a live subscription or once the trial has expired
 * (expiry enforcement lives elsewhere — this component is purely informational).
 */
export async function TrialBanner() {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return null

  const admin = createAdminClient()

  const { data: tenant } = await admin
    .from('tenants')
    .select('status, trial_ends_at')
    .eq('id', tenantId)
    .maybeSingle()

  if (!tenant || tenant.status !== 'trial' || !tenant.trial_ends_at) return null

  // Suppress if a live subscription already exists.
  const { data: liveSub } = await admin
    .from('tenant_subscriptions')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('status', ['trialing', 'active', 'past_due'])
    .limit(1)
    .maybeSingle()
  if (liveSub) return null

  const endsAt = new Date(tenant.trial_ends_at)
  const now    = Date.now()
  const msLeft = endsAt.getTime() - now
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))

  const expired = msLeft <= 0
  const urgent  = !expired && daysLeft <= 5

  return (
    <div
      className={[
        'flex items-center justify-between gap-4 border-b px-6 py-2.5 text-sm',
        expired
          ? 'border-danger/40 bg-danger/5 text-danger'
          : urgent
            ? 'border-warning/40 bg-warning/5 text-warning'
            : 'border-brand/30 bg-brand/5 text-text-primary',
      ].join(' ')}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {expired ? (
          <Clock className="h-4 w-4 shrink-0" />
        ) : (
          <Gift className="h-4 w-4 shrink-0 text-brand" />
        )}
        <p className="truncate">
          {expired ? (
            <>Your trial has ended. Pick a plan to keep everything running.</>
          ) : urgent ? (
            <>
              <strong className="font-semibold">{daysLeft} day{daysLeft === 1 ? '' : 's'} left</strong> on your free trial.
              Pick a plan before it ends.
            </>
          ) : (
            <>
              You&apos;re on a free trial. <strong className="font-semibold">{daysLeft} days</strong> remaining.
            </>
          )}
        </p>
      </div>
      <Link
        href="/settings?tab=billing"
        className={[
          'shrink-0 inline-flex items-center rounded-md px-3 py-1 text-xs font-semibold transition-colors',
          expired
            ? 'bg-danger text-white hover:bg-danger/90'
            : 'bg-brand text-white hover:bg-brand-hover',
        ].join(' ')}
      >
        {expired ? 'Choose a plan' : 'Upgrade'}
      </Link>
    </div>
  )
}
