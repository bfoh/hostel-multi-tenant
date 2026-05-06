'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageBubble } from './message-bubble'
import { StaffMessageForm } from './staff-message-form'
import { ReopenButton } from './reopen-button'

interface Message {
  id: string
  request_id: string
  author_user_id: string | null
  author_kind: 'occupant' | 'staff' | 'system'
  body: string | null
  attachments: string[]
  created_at: string
}

export function ConversationView({
  requestId, tenantId, initialThread, initialStatus,
}: {
  requestId:     string
  tenantId:      string
  initialThread: Message[]
  initialStatus: string
}) {
  const [messages, setMessages] = useState<Message[]>(initialThread)
  const [status, setStatus]     = useState<string>(initialStatus)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const sb = createClient()
    const ch = sb.channel(`maintenance-messages:${requestId}`)
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'maintenance_messages', filter: `request_id=eq.${requestId}` },
          (p) => {
            const row = p.new as unknown as Message
            setMessages(prev => prev.find(m => m.id === row.id) ? prev : [...prev, row])
            if (row.author_kind === 'system' && typeof row.body === 'string') {
              const m = row.body.match(/^Status changed: \w+ → (\w+)/)
              if (m) setStatus(m[1])
              if (row.body === 'Reopened by staff') setStatus('open')
              if (row.body === 'Closed by resident') setStatus('completed')
            }
          })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [requestId, tenantId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  const isClosed = status === 'completed' || status === 'cancelled'

  return (
    <div className="flex h-[600px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <h3 className="text-sm font-semibold text-slate-700">Conversation</h3>
        {isClosed && <ReopenButton requestId={requestId} onReopened={() => setStatus('open')} />}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0
          ? <p className="py-10 text-center text-xs text-slate-400">No messages yet.</p>
          : messages.map(m => <MessageBubble key={m.id} msg={m} scope="staff" viewerKind="staff" />)}
        <div ref={bottomRef} />
      </div>
      {!isClosed && <StaffMessageForm requestId={requestId} />}
    </div>
  )
}
