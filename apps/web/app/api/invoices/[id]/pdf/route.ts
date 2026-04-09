import { NextResponse, type NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { headers } from 'next/headers'
import React, { createElement } from 'react'
import { getInvoiceById } from '@/lib/data/invoices'
import { createClient } from '@/lib/supabase/server'
import { InvoicePDF } from '@/components/invoices/invoice-pdf'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const inv = await getInvoiceById(id)

  if (!inv) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Fetch hostel branding
  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id')

  let hostelName    = 'Your Hostel'
  let hostelTagline: string | null = null
  let hostelAddress: string | null = null
  let hostelPhone:   string | null = null
  let hostelEmail:   string | null = null
  let logoUrl:       string | null = null

  if (tenantId) {
    const supabase = await createClient()
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, tagline, address_line1, address_city, contact_phone, contact_email, logo_url')
      .eq('id', tenantId)
      .single()

    if (tenant) {
      hostelName    = tenant.name
      hostelTagline = tenant.tagline ?? null
      hostelPhone   = tenant.contact_phone ?? null
      hostelEmail   = tenant.contact_email ?? null
      logoUrl       = tenant.logo_url ?? null
      hostelAddress = [tenant.address_line1, tenant.address_city]
        .filter(Boolean).join(', ') || null
    }
  }

  const occupant = Array.isArray(inv.occupant) ? inv.occupant[0] : inv.occupant
  const room     = Array.isArray(inv.room)     ? inv.room[0]     : inv.room
  const cat      = Array.isArray(room?.category) ? room?.category[0] : room?.category
  const payments = inv.booking_payments ?? []

  const pdfBuffer = await renderToBuffer(
    createElement(InvoicePDF, {
      inv,
      occupant:     occupant ?? null,
      room:         room     ?? null,
      categoryName: (cat as any)?.name ?? 'Standard',
      payments,
      hostelName,
      hostelTagline,
      hostelAddress,
      hostelPhone,
      hostelEmail,
      logoUrl,
    }) as React.ReactElement<any>
  )

  const filename = `invoice-${inv.booking_ref}.pdf`

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      pdfBuffer.length.toString(),
    },
  })
}
