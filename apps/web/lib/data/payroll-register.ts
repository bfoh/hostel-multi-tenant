import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export interface PayrollRegisterLine {
  staff_id:        string
  staff_name:      string
  employee_id:     string | null
  ssnit_number:    string | null
  basic_salary:    number
  allowances:      number
  gross_pay:       number
  ssnit_employee:  number
  paye_tax:        number
  other_deductions:number
  total_deductions:number
  net_salary:      number
  ssnit_employer:  number   // employer's share, expense not deducted
}

export interface PayrollRegisterRun {
  id:            string
  period_start:  string
  period_end:    string
  status:        string
  paid_at:       string | null
  total_gross:   number
  totals: {
    basic:           number
    allowances:      number
    gross:           number
    ssnit_employee:  number
    paye_tax:        number
    other_deductions:number
    total_deductions:number
    net:             number
    ssnit_employer:  number
    payroll_cost:    number  // gross + employer SSNIT
  }
  lines: PayrollRegisterLine[]
}

export async function getPayrollRunsList(limit = 24): Promise<{ id: string; period_start: string; period_end: string; status: string; total_gross: number }[]> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('payroll_runs')
    .select('id, period_start, period_end, status, total_gross')
    .eq('tenant_id', tenantId)
    .order('period_start', { ascending: false })
    .limit(limit)
  return (data ?? []) as any
}

export async function getPayrollRegister(runId: string): Promise<PayrollRegisterRun | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()
  const [{ data: run }, { data: items }] = await Promise.all([
    (supabase as any)
      .from('payroll_runs')
      .select('id, period_start, period_end, status, paid_at, total_gross')
      .eq('id', runId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    (supabase as any)
      .from('payroll_items')
      .select(`
        staff_id, basic_salary, allowances,
        ssnit_employee, ssnit_employer, paye_tax, other_deductions,
        net_salary,
        staff:staff_profiles(first_name, last_name, employee_id, ssnit_number)
      `)
      .eq('tenant_id', tenantId)
      .eq('payroll_run_id', runId)
      .order('staff_id'),
  ])
  if (!run) return null

  const lines: PayrollRegisterLine[] = ((items ?? []) as any[]).map((i) => {
    const staff = Array.isArray(i.staff) ? i.staff[0] : i.staff
    const name = staff
      ? `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim()
      : 'Unknown'
    const gross = Number(i.basic_salary) + Number(i.allowances)
    const deductions = Number(i.ssnit_employee) + Number(i.paye_tax) + Number(i.other_deductions)
    return {
      staff_id:        i.staff_id,
      staff_name:      name || 'Unknown',
      employee_id:     staff?.employee_id ?? null,
      ssnit_number:    staff?.ssnit_number ?? null,
      basic_salary:    Number(i.basic_salary),
      allowances:      Number(i.allowances),
      gross_pay:       gross,
      ssnit_employee:  Number(i.ssnit_employee),
      paye_tax:        Number(i.paye_tax),
      other_deductions:Number(i.other_deductions),
      total_deductions:deductions,
      net_salary:      Number(i.net_salary),
      ssnit_employer:  Number(i.ssnit_employer),
    }
  })

  const totals = lines.reduce((t, l) => {
    t.basic += l.basic_salary
    t.allowances += l.allowances
    t.gross += l.gross_pay
    t.ssnit_employee  += l.ssnit_employee
    t.paye_tax        += l.paye_tax
    t.other_deductions+= l.other_deductions
    t.total_deductions+= l.total_deductions
    t.net             += l.net_salary
    t.ssnit_employer  += l.ssnit_employer
    return t
  }, { basic: 0, allowances: 0, gross: 0, ssnit_employee: 0, paye_tax: 0, other_deductions: 0, total_deductions: 0, net: 0, ssnit_employer: 0, payroll_cost: 0 })
  totals.payroll_cost = totals.gross + totals.ssnit_employer

  return { ...run, totals, lines }
}
