import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getOccupantSession } from '@/lib/auth/occupant-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { getThread } from '@/lib/maintenance/messages'
import { MaintenanceThread } from '@/components/occupant-portal/maintenance-thread'

export const metadata: Metadata = { title: 'Request · My Portal' }

const STATUS: Record<string, string> = {
  open:        'bg-amber-50 text-amber-700 ring-amber-200/70',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-200/70',
  on_hold:     'bg-slate-100 text-slate-600 ring-slate-200/70',
  completed:   'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  cancelled:   'bg-slate-100 text-slate-600 ring-slate-200/70',
}

export default async function OccupantMaintenanceDetail({
  params,
}: { params: Promise<{ id: string }> }) {
  const session = await getOccupantSession()
  if (!session) redirect('/login')

  const { id } = await params
  const admin = createAdminClient() as any

  const { data: req } = await admin
    .from('maintenance_requests')
    .select('id, status, priority, title, description, created_at, room:rooms(room_number, block)')
    .eq('id', id)
    .eq('tenant_id', session.tenantId)
    .eq('occupant_id', session.occupantId)
    .maybeSingle()
  if (!req) notFound()

  const thread = await getThread(id, session.tenantId)
  const room   = Array.isArray(req.room) ? req.room[0] : req.room

  return (
    <div className="space-y-3">
      <Link href="/occupant-portal/maintenance" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>

      <header className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-18px_rgba(16,24,40,0.20)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[16px] font-bold leading-snug text-slate-900">{req.title}</h1>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Room {room?.room_number ?? '—'}{room?.block ? ` · ${room.block}` : ''}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ${STATUS[req.status] ?? STATUS.open}`}>
            {String(req.status).replace('_', ' ')}
          </span>
        </div>
        {req.description && (
          <p className="mt-2.5 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600">{req.description}</p>
        )}
      </header>

      <MaintenanceThread
        requestId={id}
        tenantId={session.tenantId}
        initialThread={thread}
        status={req.status}
        color={session.tenantColor}
      />
    </div>
  )
}
