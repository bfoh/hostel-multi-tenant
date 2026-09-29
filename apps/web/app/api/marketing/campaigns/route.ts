import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { CAMPAIGN_AUDIENCES, CAMPAIGN_CHANNELS, resolveAudience } from '@/lib/marketing/audience'

const schema = z.object({
  name:     z.string().min(1).max(150),
  channel:  z.enum(CAMPAIGN_CHANNELS),
  subject:  z.string().max(200).optional().nullable(),
  body:     z.string().min(1).max(4000),
  audience: z.enum(CAMPAIGN_AUDIENCES).default('all_occupants'),
}).refine((d) => d.channel !== 'email' || !!d.subject, {
  message: 'Subject is required for email campaigns',
  path: ['subject'],
})

export async function GET(_req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('marketing_campaigns')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100)

  return NextResponse.json(data ?? [])
}

/**
 * Creates a draft and immediately resolves+stores its recipient_count —
 * the "dry run" the campaign list then shows before anyone clicks Send.
 */
export async function POST(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const recipients = await resolveAudience(supabase, tenantId, parsed.data.audience, parsed.data.channel)

  const { data, error } = await supabase
    .from('marketing_campaigns')
    .insert({
      tenant_id:       tenantId,
      created_by:      user.id,
      name:            parsed.data.name,
      channel:         parsed.data.channel,
      subject:         parsed.data.subject ?? null,
      body:            parsed.data.body,
      audience:        parsed.data.audience,
      recipient_count: recipients.length,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
