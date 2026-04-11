import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'

async function getTenantId(): Promise<string | null> {
  const h = await headers()
  return h.get('x-tenant-id')
}

export async function getOccupants(search?: string) {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()

  let query = supabase
    .from('occupants')
    .select(`
      id, first_name, last_name, other_names, phone, email, status, type,
      institution, student_id, programme, year_of_study, gender,
      photo_url, created_at,
      bookings(id, status, check_in_date, check_out_date, room:rooms(room_number))
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%,student_id.ilike.%${search}%`
    )
  }

  const { data, error } = await query.limit(50)
  if (error) return []
  return data ?? []
}

export async function getOccupantById(id: string) {
  const tenantId = await getTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('occupants')
    .select(`
      id, first_name, last_name, other_names, phone, alternate_phone, email,
      status, type, gender, date_of_birth, national_id_type, national_id_number,
      photo_url, institution, student_id, programme, year_of_study, semester,
      home_address, region_of_origin, emergency_contact, notes,
      created_at, updated_at,
      bookings(
        id, booking_ref, status, payment_status, check_in_date, check_out_date,
        final_amount, paid_amount, source, created_at,
        room:rooms(room_number, block, category:room_categories(name))
      )
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error) return null
  return data
}
