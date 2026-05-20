'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  tenantId:     string
  initialCount: number
  /** When true, render as a small dot overlay (collapsed sidebar). */
  compact?:     boolean
}

/**
 * Live count of pending website enquiries (waiting_list rows with
 * source='website' AND status='waiting'). Updates over Supabase realtime
 * with a HEAD count re-query rather than diffing event payloads — keeps
 * the badge correct under concurrent staff actions.
 *
 * Mounts even at count=0 so the subscription stays alive; renders null
 * when there's nothing to show.
 */
export function SidebarEnquiryBadge({ tenantId, initialCount, compact = false }: Props) {
  const [count, setCount] = useState(initialCount)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const sb = supabaseRef.current

    async function refresh() {
      const { count: c, error } = await sb
        .from('waiting_list')
        .select('id', { head: true, count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('source', 'website' as any)
        .eq('status', 'waiting')
      if (!error) setCount(c ?? 0)
    }

    const channel = sb
      .channel(`tenant-enquiries-badge-${tenantId}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'waiting_list',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => { refresh() })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[enquiry-badge] realtime channel', status, '— count may be stale')
        }
      })

    return () => { sb.removeChannel(channel) }
  }, [tenantId])

  if (count === 0) return null

  if (compact) {
    return (
      <span
        aria-label={`${count} new website enquiries`}
        className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-brand-fg ring-2 ring-[#000000]"
      >
        {count > 9 ? '9+' : count}
      </span>
    )
  }

  return (
    <span
      aria-label={`${count} new website enquiries`}
      className="ml-auto rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-brand-fg"
    >
      {count}
    </span>
  )
}
