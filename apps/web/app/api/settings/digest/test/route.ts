/**
 * POST /api/settings/digest/test — fire a digest right now to validate
 * channel wiring. Bypasses time-of-day + already-sent guards via `force`.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { sendDailyDigestForTenant } from '@/lib/digest/send'
import { getTenantToday } from '@/lib/reports/daily'

export async function POST() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = await getTenantToday(tenantId)
  const result = await sendDailyDigestForTenant(tenantId, today, { force: true })
  return NextResponse.json(result)
}
