/**
 * Update the walk-in QR portal configuration for a revenue point.
 * Tenant members only — RLS via tenant_id.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  public_enabled: z.boolean(),
  public_config:  z.record(z.unknown()),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('revenue_points')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await (supabase.from('revenue_points') as any)
    .update({
      public_enabled: parsed.data.public_enabled,
      public_config:  parsed.data.public_config,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id, public_enabled, public_config')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
