import { NextResponse, type NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React, { createElement } from 'react'

import { getOccupantSession } from '@/lib/auth/occupant-session'
import { getOccupantInvoiceById } from '@/lib/data/occupant-invoices'
import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'
import { InvoicePDF } from '@/components/invoices/invoice-pdf'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const inv    = await getOccupantInvoiceById(id, session.occupantId, session.tenantId)
  if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  // Tenant header info for the PDF letterhead.
  const admin = createTenantAdminClient(session.tenantId)
  const { data: tenant } = await admin
    .from('tenants')
    .select('name, tagline, address_line1, address_city, contact_phone, contact_email, logo_url, tin, vat_reg_number, is_vat_registered')
    .eq('id', session.tenantId)
    .single()

  const hostelName     = (tenant as any)?.name ?? 'Your Hostel'
  const hostelTagline  = (tenant as any)?.tagline ?? null
  const hostelPhone    = (tenant as any)?.contact_phone ?? null
  const hostelEmail    = (tenant as any)?.contact_email ?? null
  const logoUrl        = (tenant as any)?.logo_url ?? null
  const tin            = (tenant as any)?.tin ?? null
  const vatRegNumber   = (tenant as any)?.vat_reg_number ?? null
  const isVatRegistered = (tenant as any)?.is_vat_registered ?? false
  const hostelAddress  = [(tenant as any)?.address_line1, (tenant as any)?.address_city].filter(Boolean).join(', ') || null

  const occupant = Array.isArray(inv.occupant) ? inv.occupant[0] : inv.occupant
  const room     = Array.isArray(inv.room)     ? inv.room[0]     : inv.room
  const cat      = Array.isArray(room?.category) ? room?.category[0] : room?.category
  // Filter for completed payments. The status enum is
  // 'pending' | 'success' | 'failed' | 'reversed' — use 'success'.
  // (The tenant route at /api/invoices/[id]/pdf:56 still uses the wrong
  // 'paid' literal — pre-existing bug to be fixed separately.)
  const payments = (inv.booking_payments ?? []).filter((p: any) => p.status === 'success')

  try {
    const pdfBuffer = await renderToBuffer(
      createElement(InvoicePDF, {
        inv: {
          ...inv,
          invoice_number: (inv as any).invoice_number ?? null,
          vat_amount:     (inv as any).vat_amount     ?? 0,
          nhil_amount:    (inv as any).nhil_amount    ?? 0,
          getfund_amount: (inv as any).getfund_amount ?? 0,
        },
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
        tin,
        vatRegNumber,
        isVatRegistered,
      }) as React.ReactElement<any>,
    )

    const filename = `invoice-${(inv as any).invoice_number ?? inv.booking_ref}.pdf`

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      pdfBuffer.length.toString(),
      },
    })
  } catch (err) {
    console.error('[GET /api/occupant/invoices/[id]/pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF generation failed' },
      { status: 500 },
    )
  }
}
