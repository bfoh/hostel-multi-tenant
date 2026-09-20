import Link from 'next/link'
import { Sparkles, Tag, ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { formatGHS } from '@/lib/utils'
import { RecentBookings } from '@/components/dashboard/recent-bookings'

async function getCategorySummary() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('room_categories')
    .select('id, name, base_rate, rate_unit')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order')
  return data ?? []
}

/**
 * Rendered instead of the full dashboard for a tenant whose trial ended
 * without subscribing (status='trial_expired'). Room-price editing and a
 * read-only bookings view are the two things that stay live — everything
 * else is gated in middleware.ts's minimal-dashboard allow-list.
 */
export async function MinimalDashboardView({ tenantName }: { tenantName: string }) {
  const categories = await getCategorySummary()

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-warning/20 bg-warning-subtle p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-warning-fg" />
          <div className="flex-1">
            <h1 className="text-lg font-bold text-text-primary">
              {tenantName}&apos;s trial has ended
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Your hostel stays listed on the GH Hostels marketplace and guests can still
              find and book it. Subscribe to unlock the full management dashboard again —
              staff, occupants, maintenance, accounting, and more.
            </p>
            <Link
              href="/settings/billing"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg transition-colors hover:bg-brand-hover"
            >
              Reactivate your subscription
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Room prices
              </CardTitle>
              <Link
                href="/rooms/categories"
                className="text-xs font-medium text-brand hover:text-brand-hover transition-colors"
              >
                Edit prices
              </Link>
            </CardHeader>
            <CardContent className="pt-0">
              {categories.length === 0 ? (
                <p className="py-4 text-sm text-text-secondary">
                  No room types configured yet.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {categories.map((c: any) => (
                    <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="text-text-primary">{c.name}</span>
                      <span className="font-medium text-text-secondary">
                        {formatGHS(c.base_rate)} / {c.rate_unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <div>
          <RecentBookings />
        </div>
      </div>
    </div>
  )
}
