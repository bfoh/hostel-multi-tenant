'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageBubble } from '@/components/maintenance/message-bubble'
import { MaintenanceMessageForm } from './maintenance-message-form'
import { MaintenanceCloseButton } from './maintenance-close-button'

interface Message {
  id: string
  request_id: string
  author_user_id: string | null
  author_kind: 'occupant' | 'staff' | 'system'
  body: string | null
  attachments: string[]
  created_at: string
}

interface Props {
  requestId:     string
  tenantId:      string
  initialThread: Message[]
  status:        string
  color:         string
}

export function MaintenanceThread({ requestId, tenantId, initialThread, status, color }: Props) {
  const [messages, setMessages]     = useState<Message[]>(initialThread)
  const [reqStatus, setReqStatus]   = useState<string>(status)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const sb = createClient()
    const channel = sb
      .channel(`maintenance-messages:${requestId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'maintenance_messages', filter: `request_id=eq.${requestId}` },
        (payload) => {
          const row = payload.new as unknown as Message
          setMessages(prev => prev.find(m => m.id === row.id) ? prev : [...prev, row])
          if (row.author_kind === 'system' && typeof row.body === 'string') {
            // Mirror status changes to local state so the close button hides immediately
            const m = row.body.match(/^Status changed: \w+ → (\w+)/)
            if (m) setReqStatus(m[1])
            if (row.body === 'Reopened by staff') setReqStatus('open')
            if (row.body === 'Closed by resident') setReqStatus('completed')
          }
        },
      )
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [requestId, tenantId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const isClosed = reqStatus === 'completed' || reqStatus === 'cancelled'

  return (
    <div className="flex h-[calc(100vh-220px)] flex-col rounded-2xl border border-slate-200 bg-slate-50">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0
          ? <p className="py-10 text-center text-xs text-slate-400">No messages yet.</p>
          : messages.map(m => <MessageBubble key={m.id} msg={m} scope="occupant" viewerKind="occupant" />)}
        <div ref={bottomRef} />
      </div>

      {!isClosed && (reqStatus === 'in_progress' || reqStatus === 'open') && (
        <div className="border-t border-slate-200 bg-white px-3 py-2 text-right">
          <MaintenanceCloseButton requestId={requestId} onClosed={() => setReqStatus('completed')} />
        </div>
      )}

      {isClosed
        ? <p className="border-t border-slate-200 bg-white px-3 py-3 text-center text-[11px] text-slate-400">Request closed. Reopen via hostel staff.</p>
        : <MaintenanceMessageForm requestId={requestId} color={color} />}
    </div>
  )
}
