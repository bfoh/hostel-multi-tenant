import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { ShiftRota } from '@/components/staff/shift-rota'

export const metadata: Metadata = { title: 'Shift Scheduling' }

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const { week } = await searchParams
  const supabase = createAdminClient()

  // Default to current Monday
  const today = new Date()
  const day   = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  const weekStart = week ?? monday.toISOString().slice(0, 10)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)

  const [{ data: shifts }, { data: staff }] = await Promise.all([
    supabase
      .from('staff_shifts')
      .select(`*, staff_profiles(id, first_name, last_name, department)`)
      .gte('shift_date', weekStart)
      .lte('shift_date', weekEndStr)
      .order('shift_date')
      .order('shift_start'),
    supabase
      .from('staff_profiles')
      .select('id, first_name, last_name, department, position')
      .eq('is_active', true)
      .order('first_name'),
  ])

  return (
    <ShiftRota
      weekStart={weekStart}
      shifts={(shifts ?? []) as any[]}
      staff={(staff ?? []) as any[]}
    />
  )
}
