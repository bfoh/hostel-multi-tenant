import { createClient } from '@/lib/supabase/server'

export async function getStaff(search?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('staff_profiles')
    .select('id, first_name, last_name, job_title, department, employment_type, is_active, photo_url, phone, email, basic_salary, start_date, member:tenant_members(role, is_active)')
    .order('last_name')

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,job_title.ilike.%${search}%,department.ilike.%${search}%`
    )
  }

  const { data, error } = await query.limit(100)
  if (error) return []
  return data ?? []
}

export async function getStaffById(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('staff_profiles')
    .select(`
      *,
      member:tenant_members(role, is_active),
      attendance_records(id, date, clock_in, clock_out, notes),
      leave_requests(id, leave_type, start_date, end_date, days, status, reason, review_note, created_at)
    `)
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

export async function getAttendanceRecords(filter?: { staffId?: string; month?: string }) {
  const supabase = await createClient()

  let query = supabase
    .from('attendance_records')
    .select('*, staff:staff_profiles(first_name, last_name, job_title, photo_url)')
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
  const supabase = await createClient()

  let query = supabase
    .from('leave_requests')
    .select('*, staff:staff_profiles(first_name, last_name, job_title, photo_url)')
    .order('created_at', { ascending: false })

  if (filter?.status && filter.status !== 'all') {
    query = query.eq('status', filter.status as 'pending' | 'approved' | 'rejected' | 'cancelled')
  }

  const { data, error } = await query.limit(100)
  if (error) return []
  return data ?? []
}

export async function getPayrollRuns() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('payroll_runs')
    .select('*')
    .order('period_start', { ascending: false })
    .limit(24)

  if (error) return []
  return data ?? []
}

export async function getPayrollRunById(id: string) {
  const supabase = await createClient()

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
    .single()

  if (error) return null
  return data
}
