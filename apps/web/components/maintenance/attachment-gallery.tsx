'use client'

import { useState } from 'react'
import { FileText, ImageIcon, Loader2 } from 'lucide-react'

interface Props {
  messageId:    string
  attachments:  string[]
  scope:        'occupant' | 'staff'
}

export function AttachmentGallery({ messageId, attachments, scope }: Props) {
  if (attachments.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((path, idx) => (
        <Tile key={idx} messageId={messageId} idx={idx} path={path} scope={scope} />
      ))}
    </div>
  )
}

function Tile({ messageId, idx, path, scope }: { messageId: string; idx: number; path: string; scope: 'occupant' | 'staff' }) {
  const [loading, setLoading] = useState(false)
  const filename = path.split('/').pop() ?? 'file'
  const isImage  = /\.(jpe?g|png|webp|heic|heif)$/i.test(filename)

  const open = async () => {
    if (loading) return
    setLoading(true)
    const base = scope === 'occupant'
      ? `/api/occupant/maintenance/messages/${messageId}/attachments/${idx}`
      : `/api/maintenance/messages/${messageId}/attachments/${idx}`
    const res = await fetch(base)
    setLoading(false)
    if (!res.ok) return
    const { url } = await res.json()
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : isImage ? <ImageIcon className="h-3.5 w-3.5" />
                        : <FileText className="h-3.5 w-3.5" />}
      <span className="max-w-[160px] truncate">{filename}</span>
    </button>
  )
}
