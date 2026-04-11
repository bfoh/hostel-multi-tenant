import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const weekStart = searchParams.get('week') // YYYY-MM-DD of Monday

  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let query = supabase
    .from('staff_shifts')
    .select(`*, staff_profiles(id, first_name, last_name, position, department)`)
    .eq('tenant_id', tenantId)
    .order('shift_date')
    .order('shift_start')

  if (weekStart) {
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 6)
    query = query
      .gte('shift_date', weekStart)
      .lte('shift_date', end.toISOString().slice(0, 10))
  }

  const { data } = await query.limit(200)
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
  const { staff_id, shift_date, shift_start, shift_end, department, notes } = body

  if (!staff_id || !shift_date || !shift_start || !shift_end) {
    return NextResponse.json({ error: 'staff_id, shift_date, shift_start, shift_end required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('staff_shifts')
    .insert({
      tenant_id: tenantId,
      staff_id,
      shift_date,
      shift_start,
      shift_end,
      department: department ?? null,
      notes: notes ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
