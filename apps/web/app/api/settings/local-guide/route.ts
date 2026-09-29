import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  category:   z.enum(['restaurant', 'attraction', 'transport', 'shopping', 'emergency', 'other']).default('other'),
  name:       z.string().min(1).max(150),
  note:       z.string().max(500).optional().nullable(),
  distance:   z.string().max(60).optional().nullable(),
  link:       z.string().url().max(500).optional().nullable().or(z.literal('')),
  sort_order: z.number().int().default(0),
})

export async function GET(_req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('tenant_local_guide_entries')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order')
    .order('created_at')

  return NextResponse.json(data ?? [])
}

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

  const { data, error } = await supabase
    .from('tenant_local_guide_entries')
    .insert({
      tenant_id:  tenantId,
      created_by: user.id,
      ...parsed.data,
      link: parsed.data.link || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
