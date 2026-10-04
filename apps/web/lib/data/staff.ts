import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { applySearchTerms, DEFAULT_LIST_PAGE_SIZE, normalisePage } from '@/lib/data/listing'

async function getTenantId(): Promise<string | null> {
  const h = await headers()
  return h.get('x-tenant-id')
}

export async function getStaffPage(search?: string, requestedPage = 1) {
  const tenantId = await getTenantId()
  if (!tenantId) return { rows: [], total: 0, page: 1, pageSize: DEFAULT_LIST_PAGE_SIZE }

  const supabase = createAdminClient()

  let query = supabase
    .from('staff_profiles')
    .select('id, first_name, last_name, job_title, department, employment_type, is_active, photo_url, phone, email, basic_salary, start_date, user_id, member:tenant_members(role, is_active)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('last_name')

  query = applySearchTerms(
    query,
    ['first_name', 'last_name', 'job_title', 'department', 'phone', 'email'],
    search,
  )

  const page = normalisePage(requestedPage)
  const offset = (page - 1) * DEFAULT_LIST_PAGE_SIZE
  const { data, error, count } = await query.range(offset, offset + DEFAULT_LIST_PAGE_SIZE - 1)
  if (error) return { rows: [], total: 0, page, pageSize: DEFAULT_LIST_PAGE_SIZE }
  return { rows: data ?? [], total: count ?? 0, page, pageSize: DEFAULT_LIST_PAGE_SIZE }
}

export async function getStaff(search?: string) {
  return (await getStaffPage(search)).rows
}

export async function getStaffStats() {
  const tenantId = await getTenantId()
  if (!tenantId) return { total: 0, active: 0, fullTime: 0 }
  const supabase = createAdminClient()
  const [total, active, fullTime] = await Promise.all([
    supabase.from('staff_profiles').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('staff_profiles').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true),
    supabase.from('staff_profiles').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('employment_type', 'full_time'),
  ])
  return { total: total.count ?? 0, active: active.count ?? 0, fullTime: fullTime.count ?? 0 }
}

export async function getStaffById(id: string) {
  const tenantId = await getTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('staff_profiles')
    .select(`
      *,
      member:tenant_members(role, is_active),
      attendance_records(id, date, clock_in, clock_out, notes),
      leave_requests(id, leave_type, start_date, end_date, days, status, reason, review_note, created_at)
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) return null
  return data
}

export async function getAttendanceRecords(filter?: { staffId?: string; month?: string }) {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()

  let query = supabase
    .from('attendance_records')
    .select('*, staff:staff_profiles(first_name, last_name, job_title, photo_url)')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })
    .order('clock_in', { ascending: false })

  if (filter?.staffId) {
    query = query.eq('staff_id', filter.staffId)
  }

  if (filter?.month) {
    // month format: YYYY-MM
    query = query
      .gte('date', `${filter.month}-01`)
      .lte('date', `${filter.month}-31`)
  }

  const { data, error } = await query.limit(200)
  if (error) return []
  return data ?? []
}

export async function getLeaveRequests(filter?: { status?: string }) {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()

  let query = supabase
    .from('leave_requests')
    .select('*, staff:staff_profiles(first_name, last_name, job_title, photo_url)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (filter?.status && filter.status !== 'all') {
    query = query.eq('status', filter.status as 'pending' | 'approved' | 'rejected' | 'cancelled')
  }

  const { data, error } = await query.limit(100)
  if (error) return []
  return data ?? []
}

export async function getPayrollRuns() {
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('period_start', { ascending: false })
    .limit(24)

  if (error) return []
  return data ?? []
}

export async function getPayrollRunById(id: string) {
  const tenantId = await getTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()

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
    .maybeSingle()

  if (error) return null
  return data
}
