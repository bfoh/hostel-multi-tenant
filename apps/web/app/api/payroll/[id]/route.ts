import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

const schema = z.object({
  status: z.enum(['draft', 'approved', 'paid']),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()
  const { data, error } = await supabase
    .from('payroll_runs')
    .select(`
      *,
      items:payroll_items(
        id, basic_salary, allowances, ssnit_employee, ssnit_employer, paye_tax, other_deductions, net_salary, status,
        staff:staff_profiles(id, first_name, last_name, job_title, is_ssnit_exempt)
      )
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid status' }, { status: 422 })

  const supabase = await createTenantAdminClientFromHeaders()
  const update: { status: 'draft' | 'approved' | 'paid'; paid_at?: string } = { status: parsed.data.status }
  if (parsed.data.status === 'paid') {
    update.paid_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('payroll_runs')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
