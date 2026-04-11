import { NextResponse, type NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { headers } from 'next/headers'
import React, { createElement } from 'react'

import { createClient } from '@/lib/supabase/server'
import { PayslipPDF } from '@/components/payroll/payslip-pdf'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const headersList = await headers()
    const tenantId    = headersList.get('x-tenant-id')
    if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

    const supabase = await createClient()

    // Fetch payroll run with items and staff details
    const { data: run, error } = await supabase
      .from('payroll_runs')
      .select(`
        id, period_start, period_end, total_gross, status,
        items:payroll_items(
          id, basic_salary, allowances,
          ssnit_employee, ssnit_employer, paye_tax, other_deductions, net_salary,
          staff:staff_profiles(id, first_name, last_name, job_title, is_ssnit_exempt)
        )
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error || !run) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Fetch hostel branding
    let hostelName    = 'Your Hostel'
    let hostelAddress: string | null = null
    let hostelPhone:   string | null = null
    let logoUrl:       string | null = null

    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, address_line1, address_city, contact_phone, logo_url')
      .eq('id', tenantId)
      .single()

    if (tenant) {
      hostelName    = tenant.name
      hostelPhone   = tenant.contact_phone ?? null
      logoUrl       = tenant.logo_url ?? null
      hostelAddress = [tenant.address_line1, tenant.address_city].filter(Boolean).join(', ') || null
    }

    // Normalise items
    const items = (Array.isArray(run.items) ? run.items : []).map(item => ({
      ...item,
      staff: Array.isArray(item.staff) ? item.staff[0] ?? null : item.staff ?? null,
    }))

    if (items.length === 0) {
      return NextResponse.json({ error: 'No payroll items found' }, { status: 404 })
    }

    const period = `${run.period_start.slice(0, 7)}`

    const pdfBuffer = await renderToBuffer(
      createElement(PayslipPDF, {
        run,
        items,
        hostelName,
        hostelAddress,
        hostelPhone,
        logoUrl,
      }) as React.ReactElement<any>
    )

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="payslips-${period}.pdf"`,
        'Content-Length':      pdfBuffer.length.toString(),
      },
    })
  } catch (err) {
    console.error('[GET /api/payroll/[id]/payslip]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
