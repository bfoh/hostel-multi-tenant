import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  title:       z.string().min(1).max(200),
  body:        z.string().min(1).max(4000),
  category:    z.enum(['general', 'urgent', 'maintenance', 'payment', 'event']).default('general'),
  is_pinned:   z.boolean().default(false),
  published_at: z.string().optional(),
  expires_at:  z.string().optional().nullable(),
})

export async function GET(_req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('notices')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(100)

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
    .from('notices')
    .insert({ tenant_id: tenantId, created_by: user.id, ...parsed.data })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
