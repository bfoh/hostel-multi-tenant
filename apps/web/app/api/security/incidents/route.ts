import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  title:        z.string().min(1).max(200),
  description:  z.string().max(2000),
  severity:     z.enum(['low', 'medium', 'high', 'critical']),
  occurred_at:  z.string().optional(),
  location:     z.string().max(200).optional().nullable(),
  involved_parties: z.string().max(500).optional().nullable(),
  action_taken: z.string().max(1000).optional().nullable(),
  police_ref:   z.string().max(100).optional().nullable(),
})

export async function GET() {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('incident_reports')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('occurred_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('incident_reports')
    .insert({
      tenant_id:    tenantId,
      reported_by:  user.user?.id,
      occurred_at:  parsed.data.occurred_at ?? new Date().toISOString(),
      status:       'open',
      ...parsed.data,
    })
    .select('id, ref_number')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
