import { type NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const escape = (v: unknown) => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  return [
    keys.join(','),
    ...rows.map((r) => keys.map((k) => escape(r[k])).join(',')),
  ].join('\n')
}

const GHS = (p: number) => (p / 100).toFixed(2)

export async function GET(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const entity = searchParams.get('entity') ?? 'bookings'
  const from   = searchParams.get('from') ?? ''
  const to     = searchParams.get('to') ?? ''

  const supabase = await createClient()

  let rows: Record<string, unknown>[] = []
  let filename = `${entity}-export.csv`

  if (entity === 'bookings') {
    const q = supabase
      .from('bookings')
      .select('booking_ref, status, source, check_in_date, check_out_date, semester, academic_year, rate_per_unit, rate_unit, total_amount, discount_amount, tax_amount, final_amount, paid_amount, payment_status, notes, created_at, occupants(first_name, last_name, phone, email, student_id, institution), rooms(room_number, block, floor, room_categories(name))')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (from) q.gte('created_at', from + 'T00:00:00Z')
    if (to)   q.lte('created_at', to   + 'T23:59:59Z')

    const { data } = await q
    rows = (data ?? []).map((b) => {
      const occ = Array.isArray(b.occupants) ? b.occupants[0] : b.occupants
      const room = Array.isArray(b.rooms) ? b.rooms[0] : b.rooms
      const cat  = room ? (Array.isArray((room as any).room_categories) ? (room as any).room_categories[0] : (room as any).room_categories) : null
      return {
        booking_ref:       b.booking_ref,
        status:            b.status,
        source:            b.source,
        occupant_name:     occ ? `${occ.first_name} ${occ.last_name}` : '',
        occupant_phone:    occ?.phone ?? '',
        occupant_email:    occ?.email ?? '',
        student_id:        occ?.student_id ?? '',
        institution:       occ?.institution ?? '',
        room_number:       (room as any)?.room_number ?? '',
        block:             (room as any)?.block ?? '',
        category:          cat?.name ?? '',
        check_in_date:     b.check_in_date,
        check_out_date:    b.check_out_date ?? '',
        semester:          b.semester ?? '',
        academic_year:     b.academic_year ?? '',
        rate_per_unit_ghs: GHS(b.rate_per_unit),
        rate_unit:         b.rate_unit,
        total_ghs:         GHS(b.total_amount),
        discount_ghs:      GHS(b.discount_amount),
        tax_ghs:           GHS(b.tax_amount),
        final_ghs:         GHS(b.final_amount),
        paid_ghs:          GHS(b.paid_amount),
        balance_ghs:       GHS(b.final_amount - b.paid_amount),
        payment_status:    b.payment_status,
        notes:             b.notes ?? '',
        created_at:        b.created_at,
      }
    })
    filename = `bookings-${from || 'all'}-${to || 'all'}.csv`
  }

  else if (entity === 'occupants') {
    const { data } = await supabase
      .from('occupants')
      .select('first_name, last_name, other_names, gender, date_of_birth, type, status, phone, alternate_phone, email, home_address, region_of_origin, institution, student_id, programme, year_of_study, semester, national_id_type, national_id_number, notes, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    rows = (data ?? []).map((o) => ({
      full_name:       `${o.first_name} ${o.other_names ? o.other_names + ' ' : ''}${o.last_name}`,
      type:            o.type,
      status:          o.status,
      gender:          o.gender ?? '',
      date_of_birth:   o.date_of_birth ?? '',
      phone:           o.phone,
      alternate_phone: o.alternate_phone ?? '',
      email:           o.email ?? '',
      home_address:    o.home_address ?? '',
      region:          o.region_of_origin ?? '',
      institution:     o.institution ?? '',
      student_id:      o.student_id ?? '',
      programme:       o.programme ?? '',
      year_of_study:   o.year_of_study ?? '',
      semester:        o.semester ?? '',
      national_id_type:   o.national_id_type ?? '',
      national_id_number: o.national_id_number ?? '',
      notes:           o.notes ?? '',
      created_at:      o.created_at,
    }))
    filename = 'occupants-export.csv'
  }

  else if (entity === 'payments') {
    const q = supabase
      .from('booking_payments')
      .select('amount, method, reference, status, paid_at, notes, created_at, bookings(booking_ref, occupants(first_name, last_name), rooms(room_number))')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (from) q.gte('created_at', from + 'T00:00:00Z')
    if (to)   q.lte('created_at', to   + 'T23:59:59Z')

    const { data } = await q
    rows = (data ?? []).map((p) => {
      const b   = Array.isArray(p.bookings) ? p.bookings[0] : p.bookings
      const occ = b ? (Array.isArray((b as any).occupants) ? (b as any).occupants[0] : (b as any).occupants) : null
      const room = b ? (Array.isArray((b as any).rooms) ? (b as any).rooms[0] : (b as any).rooms) : null
      return {
        booking_ref:   (b as any)?.booking_ref ?? '',
        occupant_name: occ ? `${occ.first_name} ${occ.last_name}` : '',
        room_number:   (room as any)?.room_number ?? '',
        amount_ghs:    GHS(p.amount),
        method:        p.method,
        reference:     p.reference ?? '',
        status:        p.status,
        paid_at:       p.paid_at ?? '',
        notes:         p.notes ?? '',
        created_at:    p.created_at,
      }
    })
    filename = `payments-${from || 'all'}-${to || 'all'}.csv`
  }

  else if (entity === 'maintenance') {
    const q = supabase
      .from('maintenance_requests')
      .select('title, category, priority, status, source, description, created_at, rooms(room_number)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (from) q.gte('created_at', from + 'T00:00:00Z')
    if (to)   q.lte('created_at', to   + 'T23:59:59Z')

    const { data } = await q
    rows = (data ?? []).map((m) => {
      const room = Array.isArray(m.rooms) ? m.rooms[0] : m.rooms
      return {
        title:       m.title,
        category:    m.category,
        priority:    m.priority,
        status:      m.status,
        source:      m.source ?? '',
        room_number: (room as any)?.room_number ?? '',
        description: m.description ?? '',
        created_at:  m.created_at,
      }
    })
    filename = `maintenance-${from || 'all'}-${to || 'all'}.csv`
  }

  else if (entity === 'expenses') {
    const q = supabase
      .from('expenses')
      .select('category, description, vendor, amount, expense_date, payment_method, reference, notes, created_at')
      .eq('tenant_id', tenantId)
      .order('expense_date', { ascending: false })

    if (from) q.gte('expense_date', from)
    if (to)   q.lte('expense_date', to)

    const { data } = await q
    rows = (data ?? []).map((e) => ({
      category:       e.category,
      description:    e.description,
      vendor:         e.vendor ?? '',
      amount_ghs:     GHS(e.amount),
      expense_date:   e.expense_date,
      payment_method: e.payment_method ?? '',
      reference:      e.reference ?? '',
      notes:          e.notes ?? '',
      created_at:     e.created_at,
    }))
    filename = `expenses-${from || 'all'}-${to || 'all'}.csv`
  }

  const csv = toCsv(rows)
  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
