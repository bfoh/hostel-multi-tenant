import type { Metadata } from 'next'
import { MessageSquare, CheckCircle2, XCircle, Clock, Search } from 'lucide-react'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { formatDate } from '@/lib/utils'
import { BroadcastForm } from '@/components/communications/broadcast-form'
import { ListPagination } from '@/components/ui/list-pagination'
import { normalisePage, paginateRows } from '@/lib/data/listing'

export const metadata: Metadata = { title: 'Communications' }

const STATUS_STYLES: Record<string, { icon: React.ReactNode; style: string }> = {
  pending:   { icon: <Clock className="h-3.5 w-3.5" />,        style: 'text-text-secondary' },
  scheduled: { icon: <Clock className="h-3.5 w-3.5" />,        style: 'text-warning-fg' },
  sent:      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, style: 'text-success' },
  failed:    { icon: <XCircle className="h-3.5 w-3.5" />,      style: 'text-danger' },
}

export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q = '', page: pageParam } = await searchParams
  const supabase = await createTenantAdminClientFromHeaders()
  const allBlasts: any[] = []
  const fetchSize = 1000
  for (let from = 0; ; from += fetchSize) {
    const { data } = await supabase
      .from('sms_blasts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + fetchSize - 1)
    allBlasts.push(...(data ?? []))
    if ((data ?? []).length < fetchSize) break
  }
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filtered = terms.length === 0 ? allBlasts : allBlasts.filter((blast) => {
    const haystack = [blast.message, blast.status, blast.recipient_filter, blast.recipient_type]
      .filter(Boolean).join(' ').toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
  const paged = paginateRows(filtered, normalisePage(pageParam))
  const blasts = paged.rows

  const hasSms   = !!process.env.ARKESEL_API_KEY
  const hasEmail = !!(process.env.BREVO_API_KEY ?? process.env.RESEND_API_KEY)
  const hasPush  = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Communications</h1>
          <p className="mt-0.5 text-sm text-text-secondary">Broadcast messages to occupants via SMS, email, or push</p>
        </div>
        <a href="/communications/notices"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors">
          <MessageSquare className="h-4 w-4" />
          Notice Board
        </a>
      </div>

      {/* ── Broadcast form ───────────────────────────────────────── */}
      <BroadcastForm hasSms={hasSms} hasEmail={hasEmail} hasPush={hasPush} />

      <form method="get" className="flex max-w-lg gap-2">
        <div className="relative flex-1">
          <Search className="text-text-disabled pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search message, audience, or status…"
            className="border-border bg-surface text-text-primary placeholder:text-text-disabled focus:border-brand w-full rounded-md border py-2 pl-9 pr-3 text-sm focus:outline-none"
          />
        </div>
        <button className="bg-brand text-brand-fg hover:bg-brand-hover rounded-md px-3 py-2 text-sm font-semibold">Search</button>
      </form>

      {/* ── Stats strip ──────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total broadcasts" value={filtered.length} />
          <StatCard label="Messages sent" value={filtered.reduce((s, b) => s + (b.sent_count ?? 0), 0)} />
          <StatCard label="Total recipients" value={filtered.reduce((s, b) => s + (b.recipient_count ?? b.sent_count ?? 0), 0)} />
        </div>
      )}

      {/* ── Send history ─────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Send history</h2>
        {blasts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <MessageSquare className="h-10 w-10 text-text-disabled" />
            <div>
              <p className="font-medium text-text-primary">No messages sent yet</p>
              <p className="mt-0.5 text-sm text-text-secondary">
                Use the form above to broadcast a message to your occupants.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {blasts.map(blast => {
              const statusInfo = STATUS_STYLES[blast.status] ?? STATUS_STYLES.pending
              return (
                <div key={blast.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary line-clamp-2">{blast.message}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
                        <span>{(blast as any).recipient_filter ?? blast.recipient_type ?? 'Occupants'}</span>
                        {blast.sent_count != null && <span>{blast.sent_count} sent</span>}
                        <span>{formatDate(blast.created_at)}</span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs font-medium capitalize shrink-0 ${statusInfo.style}`}>
                      {statusInfo.icon}
                      {blast.status}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <ListPagination pathname="/communications" page={paged.page} pageSize={paged.pageSize} total={paged.total} params={{ q }} />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{value.toLocaleString()}</p>
    </div>
  )
}
