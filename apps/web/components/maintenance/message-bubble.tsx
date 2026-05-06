'use client'

import { AttachmentGallery } from './attachment-gallery'

interface Message {
  id: string
  author_kind: 'occupant' | 'staff' | 'system'
  body: string | null
  attachments: string[]
  created_at: string
}

function timeOf(iso: string) {
  return new Intl.DateTimeFormat('en-GH', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export function MessageBubble({
  msg, scope, viewerKind,
}: {
  msg: Message
  scope: 'occupant' | 'staff'
  viewerKind: 'occupant' | 'staff'
}) {
  if (msg.author_kind === 'system') {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-slate-100 px-3 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {msg.body} · {timeOf(msg.created_at)}
        </span>
      </div>
    )
  }

  const isMine = msg.author_kind === viewerKind
  const align  = isMine ? 'items-end' : 'items-start'
  const bg     = isMine ? 'bg-emerald-600 text-white' : 'bg-white text-slate-900 border border-slate-200'

  return (
    <div className={`flex flex-col ${align}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${bg}`}>
        {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
        <AttachmentGallery messageId={msg.id} attachments={msg.attachments} scope={scope} />
      </div>
      <span className="mt-0.5 text-[10px] text-slate-400">{timeOf(msg.created_at)}</span>
    </div>
  )
}
