'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  tenantId:     string
  initialCount: number
}

/**
 * Live count of pending bank-draft submissions for the current tenant.
 * Renders nothing when the count is zero. Updates over Supabase realtime
 * on any booking_payments change for this tenant — the actual count is
 * re-queried (cheap HEAD count) rather than diffed from event payloads,
 * so it remains correct under multi-admin races.
 */
export function SidebarDraftBadge({ tenantId, initialCount }: Props) {
  const [count, setCount] = useState(initialCount)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const sb = supabaseRef.current

    async function refresh() {
      const { count: c } = await sb
        .from('booking_payments')
        .select('id', { head: true, count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('method', 'bank_draft' as any)
        .eq('status', 'pending')
      setCount(c ?? 0)
    }

    const channel = sb
      .channel(`tenant-drafts-badge-${tenantId}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'booking_payments',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => { refresh() })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [tenantId])

  if (count === 0) return null

  return (
    <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
      {count}
    </span>
  )
}
