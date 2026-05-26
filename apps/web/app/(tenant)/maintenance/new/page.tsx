import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { NewMaintenanceForm } from '@/components/maintenance/new-maintenance-form'

export const metadata: Metadata = { title: 'New Maintenance Request' }

export default async function NewMaintenancePage() {
  const supabase = await createTenantAdminClientFromHeaders()

  const [{ data: rooms }, { data: contractors }] = await Promise.all([
    supabase.from('rooms').select('id, room_number, block').order('room_number'),
    supabase.from('contractors').select('id, name, phone').eq('is_active', true).order('name'),
  ])

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/maintenance" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Maintenance
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm text-text-primary">New request</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">New maintenance request</h1>
        <p className="mt-0.5 text-sm text-text-secondary">Log a repair or maintenance issue to track its resolution.</p>
      </div>

      <NewMaintenanceForm
        rooms={rooms ?? []}
        contractors={contractors ?? []}
      />
    </div>
  )
}
