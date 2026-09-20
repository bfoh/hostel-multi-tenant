import Link from 'next/link'
import { headers } from 'next/headers'
import { Gift, Clock } from 'lucide-react'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Shows a soft-nudge when the tenant is on the trial clock, and a distinct
 * persistent banner once the trial has expired without a subscription
 * (status='trial_expired') — access enforcement itself lives in
 * middleware.ts's minimal-dashboard allow-list; this component is purely
 * informational.
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

  if (!tenant || !['trial', 'trial_expired'].includes(tenant.status)) return null

  // Suppress if a live subscription already exists.
  const { data: liveSub } = await admin
    .from('tenant_subscriptions')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('status', ['trialing', 'active', 'past_due'])
    .limit(1)
    .maybeSingle()
  if (liveSub) return null

  if (tenant.status === 'trial_expired') {
    return (
      <div className="flex items-center justify-between gap-4 border-b border-danger/40 bg-danger/5 px-6 py-2.5 text-sm text-danger">
        <div className="flex items-center gap-2.5 min-w-0">
          <Clock className="h-4 w-4 shrink-0" />
          <p className="truncate">
            Your trial ended — you&apos;re on the free listing plan. Subscribe to unlock full management tools.
          </p>
        </div>
        <Link
          href="/settings/billing"
          className="shrink-0 inline-flex items-center rounded-md bg-danger px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-danger/90"
        >
          Choose a plan
        </Link>
      </div>
    )
  }

  if (!tenant.trial_ends_at) return null

  const endsAt = new Date(tenant.trial_ends_at)
  const now    = Date.now()
  const msLeft = endsAt.getTime() - now
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
  const urgent = msLeft > 0 && daysLeft <= 5

  return (
    <div
      className={[
        'flex items-center justify-between gap-4 border-b px-6 py-2.5 text-sm',
        urgent
          ? 'border-warning/40 bg-warning/5 text-warning'
          : 'border-brand/30 bg-brand/5 text-text-primary',
      ].join(' ')}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Gift className="h-4 w-4 shrink-0 text-brand" />
        <p className="truncate">
          {urgent ? (
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
        href="/settings/billing"
        className="shrink-0 inline-flex items-center rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        Upgrade
      </Link>
    </div>
  )
}
