import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { DraftQueue } from '@/components/payments/draft-queue'

export const metadata: Metadata = { title: 'Bank Drafts · Payments' }
export const dynamic = 'force-dynamic'

export default async function BankDraftsPage() {
  const tenantId = await getServerTenantId()
  if (!tenantId) redirect('/dashboard')

  // UI-level role gate. API routes do their own DB-authoritative check
  // via requireTenantRole — this just keeps the page out of the wrong
  // hands.
  const callerRole = (await headers()).get('x-tenant-role')
  if (callerRole !== 'owner' && callerRole !== 'accountant') {
    redirect('/dashboard')
  }

  const admin = createAdminClient()

  const { data: pending } = await admin
    .from('booking_payments')
    .select(`
      id, amount, draft_number, draft_bank_name, draft_deposit_date, draft_note,
      draft_file_path, created_at,
      booking:bookings!inner(
        id, booking_ref, final_amount, paid_amount,
        occupant:occupants(id, first_name, last_name, phone),
        room:rooms(room_number, block)
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('method', 'bank_draft' as any)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  // Filter on the action timestamp (approved_at OR rejected_at), not
  // created_at — a draft submitted days ago and just processed should
  // still appear in the last-24h window.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentlyProcessed } = await admin
    .from('booking_payments')
    .select(`
      id, amount, status, draft_number, draft_bank_name,
      approved_at, approved_by, rejected_at, rejected_by, rejected_reason, created_at,
      booking:bookings!inner(booking_ref, occupant:occupants(first_name, last_name))
    `)
    .eq('tenant_id', tenantId)
    .eq('method', 'bank_draft' as any)
    .in('status', ['success', 'failed'])
    .or(`approved_at.gte.${cutoff},rejected_at.gte.${cutoff}`)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Bank Drafts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Drafts uploaded by residents awaiting your verification. Updates live.
        </p>
      </header>

      <DraftQueue
        tenantId={tenantId}
        initialPending={(pending ?? []) as any}
        initialRecentlyProcessed={(recentlyProcessed ?? []) as any}
      />
    </div>
  )
}
