'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Megaphone, Users, MessageCircle, Pin, BellOff, Search, Loader2 } from 'lucide-react'
import type { InboxItem } from '@/lib/messages/server'
import type { PeerMap } from '@/lib/messages/peers'

interface Props {
  currentUserId: string
  initial:       InboxItem[]
  peerNames:     PeerMap
}

interface SearchHit {
  id:              string
  conversation_id: string
  sender_id:       string | null
  body:            string | null
  created_at:      string
}

export function InboxList({ currentUserId, initial, peerNames }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<InboxItem[]>(initial)
  const [filter, setFilter] = useState<'all' | 'unread' | 'groups' | 'broadcast'>('all')
  const [q, setQ]            = useState('')
  const [hits, setHits]      = useState<SearchHit[]>([])
  const [searching, setSrch] = useState(false)

  // Debounced search over body
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return }
    const id = setTimeout(async () => {
      setSrch(true)
      try {
        const res = await fetch(`/api/messages/search?q=${encodeURIComponent(q.trim())}`)
        const data = await res.json()
        setHits(data.results ?? [])
      } finally { setSrch(false) }
    }, 200)
    return () => clearTimeout(id)
  }, [q])

  /* Realtime — refresh inbox whenever any of my participations or any
     conversation I'm in changes. Keeps preview + unread up to date.    */
  useEffect(() => {
    const sb = createClient()
    const ch = sb.channel(`inbox:${currentUserId}`)
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'conversation_participants',
            filter: `user_id=eq.${currentUserId}` },
          () => router.refresh())
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          () => router.refresh())
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [currentUserId, router])

  // Apply local filter
  const visible = items.filter((i) => {
    if (filter === 'unread')    return i.unread_count > 0
    if (filter === 'groups')    return i.type === 'group'
    if (filter === 'broadcast') return i.type === 'broadcast'
    return true
  })

  const showingSearch = q.trim().length >= 2

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search messages…"
          className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-text-tertiary" />
        )}
      </div>

      {showingSearch && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {hits.length === 0 && !searching ? (
            <p className="py-6 text-center text-xs text-text-tertiary">No messages match.</p>
          ) : (
            <ul className="divide-y divide-border">
              {hits.map((h) => (
                <li key={h.id}>
                  <Link href={`/messages/${h.conversation_id}`} className="block px-4 py-2 text-sm hover:bg-surface-raised transition-colors">
                    <p className="truncate text-text-primary">{h.body}</p>
                    <p className="text-[10px] text-text-tertiary">{new Date(h.created_at).toLocaleString()}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface-sunken p-1">
        {[
          { k: 'all',       label: 'All' },
          { k: 'unread',    label: 'Unread' },
          { k: 'groups',    label: 'Groups' },
          { k: 'broadcast', label: 'Broadcasts' },
        ].map((f) => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k as any)}
            className={`flex-1 min-w-[80px] rounded-md py-1.5 text-xs font-medium transition-colors ${
              filter === f.k
                ? 'bg-surface shadow-sm text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {visible.length === 0 ? (
          <p className="py-12 text-center text-xs text-text-tertiary">
            {filter === 'unread' ? 'No unread messages.' : 'No conversations yet.'}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((i) => (
              <li key={i.conversation_id}>
                <Link
                  href={`/messages/${i.conversation_id}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-surface-raised transition-colors"
                >
                  <ConversationIcon type={i.type} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {displayName(i, peerNames)}
                      </p>
                      <span className="shrink-0 text-[10px] text-text-tertiary">
                        {i.last_message_at ? formatRelative(i.last_message_at) : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-text-secondary">
                        {i.last_message_preview ?? <span className="italic text-text-tertiary">No messages yet</span>}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        {i.pinned_at && <Pin className="h-3 w-3 text-text-tertiary" />}
                        {i.muted_until && new Date(i.muted_until) > new Date() && (
                          <BellOff className="h-3 w-3 text-text-tertiary" />
                        )}
                        {i.unread_count > 0 && (
                          <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-brand-fg">
                            {i.unread_count > 99 ? '99+' : i.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ConversationIcon({ type }: { type: InboxItem['type'] }) {
  const cls = 'mt-0.5 h-9 w-9 shrink-0 rounded-full flex items-center justify-center'
  if (type === 'broadcast') {
    return (
      <div className={`${cls} bg-amber-100 text-amber-700`}>
        <Megaphone className="h-4 w-4" />
      </div>
    )
  }
  if (type === 'group') {
    return (
      <div className={`${cls} bg-blue-100 text-blue-700`}>
        <Users className="h-4 w-4" />
      </div>
    )
  }
  return (
    <div className={`${cls} bg-surface-raised text-text-secondary`}>
      <MessageCircle className="h-4 w-4" />
    </div>
  )
}

function displayName(item: InboxItem, peers: PeerMap): string {
  if (item.title) return item.title
  if (item.type === 'broadcast') return 'Announcements'
  if (item.type === 'direct' && item.peer_user_id) {
    return peers[item.peer_user_id]?.display ?? 'Direct message'
  }
  return 'Conversation'
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const min = Math.floor(diff / 60000)
  if (min < 1)    return 'now'
  if (min < 60)   return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24)    return `${hr}h`
  const d = Math.floor(hr / 24)
  if (d < 7)     return `${d}d`
  return new Date(iso).toLocaleDateString('en-GH', { day: '2-digit', month: 'short' })
}
