import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  // Auth
  email:             z.string().email(),
  role:              z.enum(['manager', 'receptionist', 'housekeeper', 'accountant', 'security']),
  // Personal
  first_name:        z.string().min(1),
  last_name:         z.string().min(1),
  other_names:       z.string().optional().nullable(),
  date_of_birth:     z.string().optional().nullable(),
  gender:            z.enum(['male', 'female', 'prefer_not_to_say']).optional().nullable(),
  phone:             z.string().optional().nullable(),
  // Employment
  employee_id:       z.string().optional().nullable(),
  employment_type:   z.enum(['full_time', 'part_time', 'contract', 'casual']).default('full_time'),
  job_title:         z.string().optional().nullable(),
  department:        z.string().optional().nullable(),
  start_date:        z.string().optional().nullable(),
  basic_salary:      z.number().int().min(0).default(0),   // pesewas
  // Ghana IDs
  ghana_card_number: z.string().optional().nullable(),
  tin_number:        z.string().optional().nullable(),
  ssnit_number:      z.string().optional().nullable(),
  is_ssnit_exempt:   z.boolean().default(false),
  // Banking
  bank_name:         z.string().optional().nullable(),
  bank_account_number: z.string().optional().nullable(),
  bank_account_name: z.string().optional().nullable(),
  momo_number:       z.string().optional().nullable(),
  momo_network:      z.string().optional().nullable(),
  // Emergency
  emergency_name:    z.string().optional().nullable(),
  emergency_phone:   z.string().optional().nullable(),
  emergency_relation: z.string().optional().nullable(),
  // Address
  address:           z.string().optional().nullable(),
  city:              z.string().optional().nullable(),
  region:            z.string().optional().nullable(),
})

export async function GET() {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('*, member:tenant_members(role, is_active)')
    .eq('tenant_id', tenantId)
    .order('last_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const supabase = await createClient()
  const d = parsed.data

  // 1. Create or find Supabase auth user via admin invite
  //    (In production this would use Supabase admin API; for now we create member record only)
  //    We use a placeholder user_id approach: the staff member will sign up with the email.

  // 2. Check if tenant_member already exists for this email
  const { data: existingUser } = await supabase
    .from('tenant_members')
    .select('id, user_id')
    .eq('tenant_id', tenantId)
    .limit(1)

  // Create a tenant_member record (user_id can be linked later when they log in)
  const { data: member, error: memberError } = await supabase
    .from('tenant_members')
    .insert({
      tenant_id: tenantId,
      user_id:   '00000000-0000-0000-0000-000000000000', // placeholder, updated on first login
      role:      d.role,
      is_active: true,
    })
    .select('id')
    .single()

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  // 3. Create staff profile
  const { data: profile, error: profileError } = await supabase
    .from('staff_profiles')
    .insert({
      tenant_id:          tenantId,
      member_id:          member.id,
      first_name:         d.first_name,
      last_name:          d.last_name,
      other_names:        d.other_names,
      date_of_birth:      d.date_of_birth,
      gender:             d.gender,
      phone:              d.phone,
      email:              d.email,
      employee_id:        d.employee_id,
      employment_type:    d.employment_type,
      job_title:          d.job_title,
      department:         d.department,
      start_date:         d.start_date,
      basic_salary:       d.basic_salary,
      ghana_card_number:  d.ghana_card_number,
      tin_number:         d.tin_number,
      ssnit_number:       d.ssnit_number,
      is_ssnit_exempt:    d.is_ssnit_exempt,
      bank_name:          d.bank_name,
      bank_account_number: d.bank_account_number,
      bank_account_name:  d.bank_account_name,
      momo_number:        d.momo_number,
      momo_network:       d.momo_network,
      emergency_name:     d.emergency_name,
      emergency_phone:    d.emergency_phone,
      emergency_relation: d.emergency_relation,
      address:            d.address,
      city:               d.city,
      region:             d.region,
    })
    .select('id')
    .single()

  if (profileError) {
    // Rollback member creation
    await supabase.from('tenant_members').delete().eq('id', member.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json(profile, { status: 201 })
}
