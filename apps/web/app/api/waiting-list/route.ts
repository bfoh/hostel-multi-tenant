import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const { data } = await supabase
    .from('waiting_list')
    .select(`
      *,
      room_categories(id, name),
      occupants(id, first_name, last_name, phone, email)
    `)
    .eq('tenant_id', tenantId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const body = await req.json()
  const {
    category_id, occupant_id,
    contact_name, contact_phone, contact_email,
    preferred_check_in, preferred_duration, notes, priority,
  } = body

  if (!contact_name && !occupant_id) {
    return NextResponse.json({ error: 'contact_name or occupant_id required' }, { status: 400 })
  }

  const { data, error } = await (supabase.from('waiting_list') as any)
    .insert({
      tenant_id: tenantId,
      category_id: category_id ?? null,
      occupant_id: occupant_id ?? null,
      contact_name: contact_name ?? null,
      contact_phone: contact_phone ?? null,
      contact_email: contact_email ?? null,
      preferred_check_in: preferred_check_in ?? null,
      preferred_duration: preferred_duration ?? null,
      notes: notes ?? null,
      priority: priority ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
