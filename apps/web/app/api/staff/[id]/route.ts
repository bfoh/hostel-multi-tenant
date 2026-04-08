import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  first_name:        z.string().min(1).optional(),
  last_name:         z.string().min(1).optional(),
  other_names:       z.string().optional().nullable(),
  date_of_birth:     z.string().optional().nullable(),
  gender:            z.enum(['male', 'female', 'prefer_not_to_say']).optional().nullable(),
  phone:             z.string().optional().nullable(),
  employment_type:   z.enum(['full_time', 'part_time', 'contract', 'casual']).optional(),
  job_title:         z.string().optional().nullable(),
  department:        z.string().optional().nullable(),
  start_date:        z.string().optional().nullable(),
  end_date:          z.string().optional().nullable(),
  is_active:         z.boolean().optional(),
  basic_salary:      z.number().int().min(0).optional(),
  ghana_card_number: z.string().optional().nullable(),
  tin_number:        z.string().optional().nullable(),
  ssnit_number:      z.string().optional().nullable(),
  is_ssnit_exempt:   z.boolean().optional(),
  bank_name:         z.string().optional().nullable(),
  bank_account_number: z.string().optional().nullable(),
  bank_account_name: z.string().optional().nullable(),
  momo_number:       z.string().optional().nullable(),
  momo_network:      z.string().optional().nullable(),
  emergency_name:    z.string().optional().nullable(),
  emergency_phone:   z.string().optional().nullable(),
  emergency_relation: z.string().optional().nullable(),
  address:           z.string().optional().nullable(),
  city:              z.string().optional().nullable(),
  region:            z.string().optional().nullable(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff_profiles')
    .select(`*, member:tenant_members(role, is_active),
      attendance_records(id, date, clock_in, clock_out),
      leave_requests(id, leave_type, start_date, end_date, status)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('staff_profiles')
    .update(parsed.data)
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
