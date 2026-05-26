import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { LfItemForm } from '@/components/lost-found/lf-item-form'

export const metadata: Metadata = { title: 'Log Found Item' }

export default async function NewLfItemPage() {
  const supabase = await createTenantAdminClientFromHeaders()
  const [{ data: occupants }, { data: rooms }] = await Promise.all([
    supabase.from('occupants').select('id, first_name, last_name').eq('status', 'active').order('first_name'),
    supabase.from('rooms').select('id, room_number, block').order('room_number'),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/lost-found" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Lost &amp; Found
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm font-medium text-text-primary">Log item</span>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Log Found Item</h1>
        <p className="mt-1 text-sm text-text-secondary">Record a found item so occupants can claim it.</p>
      </div>
      <LfItemForm occupants={occupants ?? []} rooms={rooms ?? []} />
    </div>
  )
}
