import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  message:       z.string().min(1).max(160),
  recipient_type: z.enum(['all_occupants', 'active_occupants', 'overdue_rent', 'specific_rooms', 'manual_list']),
  room_numbers:  z.array(z.string()).optional(),
  phone_numbers: z.array(z.string()).optional(),
  scheduled_at:  z.string().optional().nullable(),
})

export async function GET() {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()
  const { data, error } = await supabase
    .from('sms_blasts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  // Resolve the caller via the session client (RLS-bound, fine for auth.getUser).
  const session = await createClient()
  const { data: user } = await session.auth.getUser()

  // Use the admin client for every DB read/write so RLS doesn't silently
  // return empty arrays / block inserts.
  const supabase = await createTenantAdminClientFromHeaders()

  // Resolve recipient phone numbers (always tenant-scoped)
  let phoneNumbers: string[] = []
  let recipientCount = 0

  if (parsed.data.recipient_type === 'manual_list') {
    phoneNumbers = parsed.data.phone_numbers ?? []
  } else if (parsed.data.recipient_type === 'all_occupants') {
    const { data: occupants } = await supabase
      .from('occupants')
      .select('phone')
      .eq('tenant_id', tenantId)
      .not('phone', 'is', null)
    phoneNumbers = (occupants ?? []).map(o => o.phone).filter(Boolean) as string[]
  } else if (parsed.data.recipient_type === 'active_occupants') {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('occupant:occupants(phone)')
      .eq('tenant_id', tenantId)
      .eq('status', 'checked_in')
    phoneNumbers = (bookings ?? [])
      .flatMap(b => Array.isArray(b.occupant) ? b.occupant : [b.occupant])
      .map(o => o?.phone)
      .filter(Boolean) as string[]
  } else if (parsed.data.recipient_type === 'overdue_rent') {
    const { data: overdue } = await supabase
      .from('bookings')
      .select('occupant:occupants(phone)')
      .eq('tenant_id', tenantId)
      .eq('status', 'checked_in')
      .eq('payment_status', 'unpaid')
    phoneNumbers = (overdue ?? [])
      .flatMap(b => Array.isArray(b.occupant) ? b.occupant : [b.occupant])
      .map(o => o?.phone)
      .filter(Boolean) as string[]
  } else if (parsed.data.recipient_type === 'specific_rooms' && parsed.data.room_numbers?.length) {
    const { data: rooms } = await supabase
      .from('rooms')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('room_number', parsed.data.room_numbers)
    const roomIds = (rooms ?? []).map(r => r.id)

    const { data: bookings } = await supabase
      .from('bookings')
      .select('occupant:occupants(phone)')
      .eq('tenant_id', tenantId)
      .in('room_id', roomIds)
      .eq('status', 'checked_in')
    phoneNumbers = (bookings ?? [])
      .flatMap(b => Array.isArray(b.occupant) ? b.occupant : [b.occupant])
      .map(o => o?.phone)
      .filter(Boolean) as string[]
  }

  // Deduplicate
  phoneNumbers = [...new Set(phoneNumbers)]
  recipientCount = phoneNumbers.length

  // Create blast record
  const { data: blast, error: blastError } = await (supabase.from('sms_blasts') as any)
    .insert({
      tenant_id:       tenantId,
      created_by:      user.user?.id,
      message:         parsed.data.message,
      recipient_type:  parsed.data.recipient_type,
      recipient_count: recipientCount,
      status:          parsed.data.scheduled_at ? 'scheduled' : 'pending',
      scheduled_at:    parsed.data.scheduled_at,
    })
    .select('id')
    .single()

  if (blastError) return NextResponse.json({ error: blastError.message }, { status: 500 })

  // Send immediately if not scheduled and ARKESEL_API_KEY is set
  if (!parsed.data.scheduled_at && process.env.ARKESEL_API_KEY) {
    // Fire and forget
    sendBulkSMS(blast.id, parsed.data.message, phoneNumbers, tenantId, supabase).catch(() => {})
  }

  return NextResponse.json({ ...blast, recipient_count: recipientCount }, { status: 201 })
}

async function sendBulkSMS(
  blastId: string,
  message: string,
  phones: string[],
  tenantId: string,
  supabase: Awaited<ReturnType<typeof createTenantAdminClientFromHeaders>>,
) {
  const apiKey = process.env.ARKESEL_API_KEY!
  const senderName = process.env.ARKESEL_SENDER_ID ?? 'GH Hostels'

  const normalise = (p: string) =>
    p.startsWith('0') ? `233${p.slice(1)}` : p.startsWith('+') ? p.slice(1) : p

  // Arkesel batch limit: 50 per request
  let sent = 0
  let failed = 0
  for (let i = 0; i < phones.length; i += 50) {
    const batch = phones.slice(i, i + 50).map(normalise)
    try {
      const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: senderName, message, recipients: batch }),
      })
      if (res.ok) sent += batch.length
      else failed += batch.length
    } catch {
      failed += batch.length
    }
  }

  await (supabase.from('sms_blasts') as any)
    .update({
      status:     failed === phones.length ? 'failed' : 'sent',
      sent_at:    new Date().toISOString(),
      sent_count: sent,
      failed_count: failed,
    })
    .eq('id', blastId)
    .eq('tenant_id', tenantId)
}
