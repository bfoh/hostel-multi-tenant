/**
 * POST /api/settings/digest/pause   { days: number } — pause for N days
 * DELETE /api/settings/digest/pause — resume immediately
 *
 * Sets/clears `tenants.daily_digest_paused_until`. The cron checks this
 * before computing or sending.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

const pauseSchema = z.object({
  days: z.number().int().min(1).max(90),
})

export async function POST(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = pauseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'days must be 1–90' }, { status: 422 })
  }

  const until = new Date(Date.now() + parsed.data.days * 24 * 3600_000).toISOString()
  const supabase = await createTenantAdminClientFromHeaders()
  const { error } = await (supabase.from('tenants') as any)
    .update({ daily_digest_paused_until: until })
    .eq('id', tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ paused_until: until })
}

export async function DELETE() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()
  const { error } = await (supabase.from('tenants') as any)
    .update({ daily_digest_paused_until: null })
    .eq('id', tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ paused_until: null })
}
