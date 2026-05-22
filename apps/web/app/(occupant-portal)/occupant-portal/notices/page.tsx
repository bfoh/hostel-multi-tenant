import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { redirect } from 'next/navigation'
import { Bell, Pin } from 'lucide-react'

export const metadata: Metadata = { title: 'Notices · My Portal' }

function date(d: string) {
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))
}

const CATEGORY_CONFIG: Record<string, { label: string; cls: string }> = {
  urgent:      { label: 'Urgent',      cls: 'bg-red-100 text-red-700 border-red-200'       },
  payment:     { label: 'Payment',     cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  maintenance: { label: 'Maintenance', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  event:       { label: 'Event',       cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  general:     { label: 'General',     cls: 'bg-slate-100 text-slate-600 border-slate-200' },
}

export default async function NoticesPage() {
  const session = await getOccupantSession()
  if (!session) redirect('/occupant-portal')

  const { tenantId, tenantColor: color } = session
  const admin = createAdminClient()

  const { data: noticesRaw } = await admin
    .from('notices')
    .select('id, title, category, body, is_pinned, published_at, expires_at')
    .eq('tenant_id', tenantId)
    .lte('published_at', new Date().toISOString())
    .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(50)

  const notices = (noticesRaw ?? []) as any[]
  const pinned  = notices.filter(n => n.is_pinned)
  const rest    = notices.filter(n => !n.is_pinned)

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${color}14` }}
        >
          <Bell className="h-5 w-5" style={{ color }} strokeWidth={2.1} />
        </span>
        <div>
          <h1 className="text-[18px] font-bold tracking-tight text-slate-900">Notices</h1>
          <p className="text-[12px] text-slate-500">{notices.length} active notice{notices.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Empty state */}
      {notices.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-slate-200/70 bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-18px_rgba(16,24,40,0.20)]">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-100">
            <Bell className="h-7 w-7 text-slate-300" />
          </span>
          <p className="mt-3 text-[14px] font-semibold text-slate-700">No notices at the moment</p>
          <p className="mt-0.5 text-[12.5px] text-slate-400">Check back later for updates from management.</p>
        </div>
      )}

      {/* Pinned */}
      {pinned.length > 0 && (
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <Pin className="h-3 w-3" /> Pinned
          </p>
          <div className="space-y-2.5">
            {pinned.map(n => (
              <NoticeCard key={n.id} notice={n} color={color} />
            ))}
          </div>
        </section>
      )}

      {/* Rest */}
      {rest.length > 0 && (
        <section>
          {pinned.length > 0 && (
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Latest</p>
          )}
          <div className="space-y-2.5">
            {rest.map(n => (
              <NoticeCard key={n.id} notice={n} color={color} />
            ))}
          </div>
        </section>
      )}

    </div>
  )
}

function NoticeCard({ notice, color }: { notice: any; color: string }) {
  const cat = CATEGORY_CONFIG[notice.category] ?? CATEGORY_CONFIG.general

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-18px_rgba(16,24,40,0.20)]">
      {/* Coloured top strip for urgent/pinned */}
      {(notice.is_pinned || notice.category === 'urgent') && (
        <div className="h-1" style={{ backgroundColor: notice.category === 'urgent' ? '#ef4444' : color }} />
      )}
      <div className="px-5 py-4 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex-1 text-sm font-semibold leading-snug text-slate-800">{notice.title}</h3>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${cat.cls}`}>
            {cat.label}
          </span>
        </div>
        {notice.body && (
          <p className="text-sm text-slate-600 leading-relaxed">{notice.body}</p>
        )}
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-400">{date(notice.published_at)}</p>
          {notice.expires_at && (
            <p className="text-[11px] text-slate-400">
              Expires {date(notice.expires_at)}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
