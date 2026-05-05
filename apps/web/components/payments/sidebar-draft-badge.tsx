'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  tenantId:     string
  initialCount: number
  /** When true, render as a small dot overlay (for the collapsed sidebar). */
  compact?:     boolean
}

/**
 * Live count of pending bank-draft submissions for the current tenant.
 * Renders nothing when the count is zero. Updates over Supabase realtime
 * on any booking_payments change for this tenant — the count is re-queried
 * via a cheap HEAD count rather than diffed from event payloads, so it
 * remains correct under multi-admin races.
 *
 * The component always mounts (regardless of count) so the subscription
 * stays alive when the sidebar is collapsed; it just returns null when
 * there's nothing to show.
 */
export function SidebarDraftBadge({ tenantId, initialCount, compact = false }: Props) {
  const [count, setCount] = useState(initialCount)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const sb = supabaseRef.current

    async function refresh() {
      const { count: c, error } = await sb
        .from('booking_payments')
        .select('id', { head: true, count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('method', 'bank_draft' as any)
        .eq('status', 'pending')
      // On error, keep the previous count rather than showing zero —
      // a stale badge is less misleading than a disappearing one.
      if (!error) setCount(c ?? 0)
    }

    const channel = sb
      .channel(`tenant-drafts-badge-${tenantId}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'booking_payments',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => { refresh() })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[draft-badge] realtime channel', status, '— count may be stale')
        }
      })

    return () => { sb.removeChannel(channel) }
  }, [tenantId])

  if (count === 0) return null

  if (compact) {
    return (
      <span
        aria-label={`${count} pending bank drafts`}
        className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-[#000000]"
      >
        {count > 9 ? '9+' : count}
      </span>
    )
  }

  return (
    <span
      aria-label={`${count} pending bank drafts`}
      className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
    >
      {count}
    </span>
  )
}
