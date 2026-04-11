import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  category:       z.enum(['utilities','repairs','salaries','supplies','maintenance','marketing','insurance','rent','equipment','other']),
  description:    z.string().min(1).max(500),
  vendor:         z.string().max(200).optional(),
  amount:         z.number().int().positive(),   // pesewas
  expense_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payment_method: z.enum(['cash','bank_transfer','momo','card','cheque']).optional(),
  reference:      z.string().max(100).optional(),
  notes:          z.string().max(1000).optional(),
})

export async function GET(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const from     = searchParams.get('from')
  const to       = searchParams.get('to')
  const category = searchParams.get('category')

  const supabase = await createClient()
  let q = supabase
    .from('expenses')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('expense_date', { ascending: false })
    .limit(200)

  if (from)     q = q.gte('expense_date', from)
  if (to)       q = q.lte('expense_date', to)
  if (category) q = q.eq('category', category)

  const { data } = await q
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
    .from('expenses')
    .insert({ tenant_id: tenantId, created_by: user.id, ...parsed.data })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
