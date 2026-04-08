import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { computeMonthlyPayroll, formatPayrollSummary } from '@/lib/payroll/ghana-tax'

const schema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes:        z.string().max(500).optional().nullable(),
})

export async function GET() {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payroll_runs')
    .select('*, items:payroll_items(count)')
    .eq('tenant_id', tenantId)
    .order('period_start', { ascending: false })
    .limit(24)

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

  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  // Fetch all active staff
  const { data: staff, error: staffError } = await supabase
    .from('staff_profiles')
    .select('id, basic_salary, is_ssnit_exempt, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 })
  if (!staff?.length) return NextResponse.json({ error: 'No active staff found' }, { status: 422 })

  // Create payroll run
  const totalGross = staff.reduce((sum, s) => sum + (s.basic_salary ?? 0), 0)
  const { data: run, error: runError } = await supabase
    .from('payroll_runs')
    .insert({
      tenant_id:    tenantId,
      period_start: parsed.data.period_start,
      period_end:   parsed.data.period_end,
      total_gross:  totalGross,
      status:       'draft',
      created_by:   user.user?.id,
      notes:        parsed.data.notes,
    })
    .select('id')
    .single()

  if (runError) return NextResponse.json({ error: runError.message }, { status: 500 })

  // Create payroll items for each staff member
  const items = staff.map(s => {
    const comp = computeMonthlyPayroll(s.basic_salary ?? 0, 0, s.is_ssnit_exempt ?? false)
    const summary = formatPayrollSummary(comp)
    return {
      tenant_id:      tenantId,
      payroll_run_id: run.id,
      staff_id:       s.id,
      ...summary,
      status:         'pending' as const,
    }
  })

  const { error: itemsError } = await supabase
    .from('payroll_items')
    .insert(items)

  if (itemsError) {
    await supabase.from('payroll_runs').delete().eq('id', run.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  return NextResponse.json(run, { status: 201 })
}
