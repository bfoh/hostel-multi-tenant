import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getServerTenantId } from '@/lib/auth/tenant'

const schema = z.object({
  // Auth
  email:             z.string().email(),
  role:              z.enum(['manager', 'receptionist', 'housekeeper', 'accountant', 'security']),
  // Personal
  first_name:        z.string().min(1),
  last_name:         z.string().min(1),
  other_names:       z.string().optional().nullable(),
  date_of_birth:     z.preprocess(v => v === '' ? null : v, z.string().optional().nullable()),
  gender:            z.preprocess(v => v === '' ? null : v, z.enum(['male', 'female', 'prefer_not_to_say']).optional().nullable()),
  phone:             z.string().optional().nullable(),
  // Employment
  employee_id:       z.string().optional().nullable(),
  employment_type:   z.enum(['full_time', 'part_time', 'contract', 'casual']).default('full_time'),
  job_title:         z.string().optional().nullable(),
  department:        z.string().optional().nullable(),
  start_date:        z.preprocess(v => v === '' ? null : v, z.string().optional().nullable()),
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
  const tenantId = await getServerTenantId()
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
  try {
    const tenantId = await getServerTenantId()
    if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

    const admin = createAdminClient()
    const d = parsed.data

    // 1. Create or find the auth user — use createUser so it works without email infra
    let authUserId: string

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email:            d.email,
      email_confirm:    true,   // mark email as verified immediately
      user_metadata:    { tenant_id: tenantId, role: d.role },
    })

    if (createError) {
      // Email already registered — find existing user
      if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
        const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
        const found = list?.users?.find(u => u.email?.toLowerCase() === d.email.toLowerCase())
        if (!found) return NextResponse.json({ error: `User lookup failed: ${createError.message}` }, { status: 500 })
        authUserId = found.id
      } else {
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }
    } else {
      authUserId = created.user.id
    }

    // 2. Check if this user is already a member of this tenant
    const { data: existingMember } = await admin
      .from('tenant_members')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', authUserId)
      .maybeSingle()

    let memberId: string

    if (existingMember) {
      await admin.from('tenant_members').update({ role: d.role as 'manager' }).eq('id', existingMember.id)
      memberId = existingMember.id
    } else {
      const { data: member, error: memberError } = await admin
        .from('tenant_members')
        .insert({
          tenant_id:  tenantId,
          user_id:    authUserId,
          role:       d.role as 'manager',
          is_active:  true,
          invited_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })
      memberId = member.id
    }

    // 3. Create (or update) staff profile — upsert on (tenant_id, member_id)
    const { data: profile, error: profileError } = await admin
      .from('staff_profiles')
      .upsert({
        tenant_id:           tenantId,
        member_id:           memberId,
        user_id:             authUserId,
        first_name:          d.first_name,
        last_name:           d.last_name,
        other_names:         d.other_names,
        date_of_birth:       d.date_of_birth,
        gender:              d.gender,
        phone:               d.phone,
        email:               d.email,
        employee_id:         d.employee_id,
        employment_type:     d.employment_type,
        job_title:           d.job_title,
        department:          d.department,
        start_date:          d.start_date,
        basic_salary:        d.basic_salary,
        ghana_card_number:   d.ghana_card_number,
        tin_number:          d.tin_number,
        ssnit_number:        d.ssnit_number,
        is_ssnit_exempt:     d.is_ssnit_exempt,
        bank_name:           d.bank_name,
        bank_account_number: d.bank_account_number,
        bank_account_name:   d.bank_account_name,
        momo_number:         d.momo_number,
        momo_network:        d.momo_network,
        emergency_name:      d.emergency_name,
        emergency_phone:     d.emergency_phone,
        emergency_relation:  d.emergency_relation,
        address:             d.address,
        city:                d.city,
        region:              d.region,
      }, { onConflict: 'tenant_id,member_id' })
      .select('id')
      .single()

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

    return NextResponse.json(profile, { status: 201 })
  } catch (err) {
    console.error('[POST /api/staff]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
