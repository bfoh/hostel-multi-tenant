'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Tiny badge component that polls + listens for new messages and renders
 * the unread total next to a messages nav item.
 *
 * Drop in next to the Messages nav link:
 *   <UnreadBadge userId={user.id} />
 */
export function UnreadBadge({ userId }: { userId: string }) {
  const [count, setCount] = useState<number | null>(null)

  async function refresh() {
    try {
      const res = await fetch('/api/messages/conversations', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const total = Array.isArray(data)
        ? data.reduce((s: number, i: any) => s + (i.unread_count ?? 0), 0)
        : 0
      setCount(total)
    } catch {
      // ignore
    }
  }

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    const sb = createClient()
    const ch = sb.channel(`unread:${userId}`)
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          () => refresh())
      .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'conversation_participants',
            filter: `user_id=eq.${userId}` },
          () => refresh())
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [userId])

  if (count == null || count === 0) return null
  return (
    <span className="ml-auto rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}
