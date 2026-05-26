import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'

const schema = z.object({
  first_name:         z.string().min(1).max(100).optional(),
  last_name:          z.string().min(1).max(100).optional(),
  other_names:        z.string().max(100).nullable().optional(),
  phone:              z.string().min(10).max(15).optional(),
  alternate_phone:    z.string().max(15).nullable().optional(),
  email:              z.string().email().nullable().optional(),
  gender:             z.enum(['male', 'female', 'prefer_not_to_say']).nullable().optional(),
  date_of_birth:      z.string().nullable().optional(),
  type:               z.enum(['student', 'professional', 'guest', 'staff']).optional(),
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const admin = await createTenantAdminClientFromHeaders()
  const { data, error } = await admin
    .from('occupants')
    .update(parsed.data)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const admin = await createTenantAdminClientFromHeaders()

  // Fetch the occupant first so we can clean up their auth account
  const { data: occupant } = await admin
    .from('occupants')
    .select('user_id, email')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  // Delete the occupant — the DB cascade handles everything else:
  //   bookings (→ booking_payments, payment_plans, damage_deposits, feedback)
  //   occupant_documents, id_verification_reviews, occupant_blacklist
  //   lost_and_found.occupant_id, waiting_list.occupant_id  → SET NULL
  const { error } = await admin
    .from('occupants')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Delete the auth account so the email can be reused for a fresh invite later
  if (occupant?.user_id) {
    await admin.auth.admin.deleteUser(occupant.user_id)
  }

  return NextResponse.json({ ok: true })
}
