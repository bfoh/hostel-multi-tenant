import { type NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { InvoiceDocument } from '@/components/bookings/invoice-document'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Auth check via RLS-bound client
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Data fetch via admin client + explicit tenant_id filter so stale JWT
  // claims can't make a valid booking 404.
  const supabase = await createTenantAdminClientFromHeaders()

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      booking_ref, status, check_in_date, check_out_date, semester, academic_year,
      rate_per_unit, rate_unit, total_amount, discount_amount, discount_reason,
      tax_amount, final_amount, paid_amount, payment_status, notes, created_at,
      occupants(first_name, last_name, other_names, phone, email, student_id, institution),
      rooms(room_number, block, floor, room_categories(name)),
      booking_payments(amount, method, reference, paid_at, status)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, tagline, contact_phone, contact_email, address_line1, address_city, address_region, website_url, logo_url, primary_color')
    .eq('id', tenantId)
    .single()

  const buffer = await renderToBuffer(
    createElement(InvoiceDocument, { booking: booking as any, tenant: tenant as any }) as any
  )

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${booking.booking_ref}.pdf"`,
    },
  })
}
