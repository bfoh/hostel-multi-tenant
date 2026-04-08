import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getServerTenantId } from '@/lib/auth/tenant'

const schema = z.object({
  first_name:         z.string().min(1).max(100),
  last_name:          z.string().min(1).max(100),
  other_names:        z.string().max(100).nullable().optional(),
  phone:              z.string().min(10).max(15),
  alternate_phone:    z.string().max(15).nullable().optional(),
  email:              z.string().email().nullable().optional(),
  gender:             z.enum(['male', 'female', 'prefer_not_to_say']).nullable().optional(),
  date_of_birth:      z.string().nullable().optional(),
  type:               z.enum(['student', 'professional', 'guest', 'staff']),
  national_id_type:   z.enum(['ghana_card', 'passport', 'voters_id', 'nhis']).nullable().optional(),
  national_id_number: z.string().max(50).nullable().optional(),
  institution:        z.string().max(200).nullable().optional(),
  student_id:         z.string().max(50).nullable().optional(),
  programme:          z.string().max(200).nullable().optional(),
  year_of_study:      z.number().int().min(1).max(10).nullable().optional(),
  semester:           z.enum(['first', 'second', 'summer']).nullable().optional(),
  home_address:       z.string().max(300).nullable().optional(),
  region_of_origin:   z.string().nullable().optional(),
  emergency_contact:  z.record(z.string()).nullable().optional(),
  notes:              z.string().max(500).nullable().optional(),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const tenantId = await getServerTenantId()
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 401 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('occupants')
    .insert({ ...parsed.data, tenant_id: tenantId })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
