'use client'

import { useEffect, useState } from 'react'
import { FileText, Download, Music } from 'lucide-react'
import { readUrlFor, type AttachmentRecord } from '@/lib/messages/upload'

interface Props {
  attachment: AttachmentRecord
  mine:       boolean
}

function isImage(mime: string) { return mime.startsWith('image/') }
function isAudio(mime: string) { return mime.startsWith('audio/') }
function isVideo(mime: string) { return mime.startsWith('video/') }

function fmtSize(b: number) {
  if (b < 1024)            return `${b} B`
  if (b < 1024 * 1024)     return `${Math.round(b / 1024)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentView({ attachment, mine }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState<boolean>(false)

  useEffect(() => {
    let abort = false
    readUrlFor(attachment.path).then((u) => {
      if (abort) return
      if (u) setUrl(u)
      else   setErr(true)
    })
    return () => { abort = true }
  }, [attachment.path])

  if (err) {
    return <p className="text-xs italic text-text-tertiary">Attachment unavailable</p>
  }

  if (isImage(attachment.mime)) {
    return (
      <a href={url ?? '#'} target="_blank" rel="noopener noreferrer" className="block">
        {url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={url} alt={attachment.filename}
                 className="max-h-80 rounded-lg object-cover"
                 style={{ aspectRatio: attachment.width && attachment.height ? `${attachment.width}/${attachment.height}` : undefined }} />
          : <div className="h-40 w-60 animate-pulse rounded-lg bg-surface-sunken" />}
      </a>
    )
  }

  if (isAudio(attachment.mime)) {
    return (
      <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${mine ? 'bg-white/10' : 'bg-surface-raised'}`}>
        <Music className="h-3.5 w-3.5 shrink-0 opacity-70" />
        {url
          ? <audio controls src={url} className="h-8 max-w-[220px]" preload="metadata" />
          : <span className="text-[11px] opacity-70">Loading audio…</span>}
        {attachment.duration_s != null && (
          <span className="text-[10px] opacity-70">{attachment.duration_s}s</span>
        )}
      </div>
    )
  }

  if (isVideo(attachment.mime)) {
    return url ? (
      <video src={url} controls className="max-h-80 rounded-lg" />
    ) : (
      <div className="h-40 w-60 animate-pulse rounded-lg bg-surface-sunken" />
    )
  }

  // Generic file pill
  return (
    <a
      href={url ?? '#'}
      target="_blank" rel="noopener noreferrer"
      className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
        mine ? 'bg-white/10 hover:bg-white/20' : 'bg-surface-raised hover:bg-surface-sunken'
      } transition-colors`}
    >
      <FileText className="h-4 w-4 shrink-0 opacity-80" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{attachment.filename}</p>
        <p className="text-[10px] opacity-70">{fmtSize(attachment.size)}</p>
      </div>
      <Download className="h-3.5 w-3.5 opacity-70" />
    </a>
  )
}
