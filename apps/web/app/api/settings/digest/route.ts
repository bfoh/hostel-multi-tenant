/**
 * GET  /api/settings/digest        — read tenant digest config
 * PATCH /api/settings/digest       — update enabled / time / channels / recipients
 * POST  /api/settings/digest/test  — trigger an immediate digest send (force)
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

const recipientSchema = z.object({
  name:  z.string().max(120).optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
})

const channelsSchema = z.object({
  sms:   z.boolean().optional(),
  email: z.boolean().optional(),
  push:  z.boolean().optional(),
})

const patchSchema = z.object({
  enabled:    z.boolean().optional(),
  time:       z.string().regex(/^\d{2}:\d{2}$/).optional(),
  channels:   channelsSchema.optional(),
  recipients: z.array(recipientSchema).max(10).optional(),
})

export async function GET() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()
  const { data } = await supabase
    .from('tenants')
    .select('daily_digest_enabled, daily_digest_time, daily_digest_channels, daily_digest_recipients, timezone')
    .eq('id', tenantId)
    .single()
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const update: Record<string, unknown> = {}
  if (parsed.data.enabled !== undefined)    update.daily_digest_enabled = parsed.data.enabled
  if (parsed.data.time !== undefined)       update.daily_digest_time    = parsed.data.time
  if (parsed.data.channels !== undefined)   update.daily_digest_channels = parsed.data.channels
  if (parsed.data.recipients !== undefined) update.daily_digest_recipients = parsed.data.recipients

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const supabase = await createTenantAdminClientFromHeaders()
  const { error } = await (supabase.from('tenants') as any)
    .update(update)
    .eq('id', tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = await supabase
    .from('tenants')
    .select('daily_digest_enabled, daily_digest_time, daily_digest_channels, daily_digest_recipients, timezone')
    .eq('id', tenantId)
    .single()
  return NextResponse.json(data)
}
