import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerBusinessType } from '@/lib/auth/tenant'
import { GroupInvoiceDocument } from '@/components/bookings/group-invoice-document'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if ((await getServerBusinessType()) !== 'hotel') {
    return NextResponse.json({ error: 'Not available for this account type' }, { status: 403 })
  }

  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()

  const { data: group } = await supabase
    .from('booking_groups')
    .select('group_ref, billing_contact_name, billing_contact_email, billing_contact_phone, created_at')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      booking_ref, total_amount, final_amount, paid_amount,
      occupant:occupants(first_name, last_name),
      room:rooms(room_number)
    `)
    .eq('group_id', id)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, contact_phone, contact_email, address_line1, address_city, address_region, logo_url, primary_color')
    .eq('id', tenantId)
    .single()

  const rooms = (bookings ?? []).map((b) => {
    const occupant = Array.isArray(b.occupant) ? b.occupant[0] : b.occupant
    const room = Array.isArray(b.room) ? b.room[0] : b.room
    return {
      bookingRef:  b.booking_ref,
      roomNumber:  room?.room_number ?? null,
      guestName:   occupant ? `${occupant.first_name} ${occupant.last_name}` : 'Guest',
      totalAmount: b.total_amount,
      finalAmount: b.final_amount,
      paidAmount:  b.paid_amount,
    }
  })

  const buffer = await renderToBuffer(
    createElement(GroupInvoiceDocument, { group: group as any, rooms, tenant: tenant as any }) as any
  )

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="group-invoice-${group.group_ref}.pdf"`,
    },
  })
}
