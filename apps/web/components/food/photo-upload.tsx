'use client'

import { useState, useRef } from 'react'
import { Upload, Loader2 } from 'lucide-react'

export function PhotoUpload({ itemId, currentUrl, onUploaded }: {
  itemId:     string
  currentUrl: string | null
  onUploaded: (url: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  const onPick: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setErr(null)
    const fd = new FormData()
    fd.set('file', file)
    const res = await fetch(`/api/menu/items/${itemId}/photo`, { method: 'POST', body: fd })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => null) as any
      setErr(j?.error ?? 'Upload failed'); return
    }
    const { photo_url } = await res.json()
    onUploaded(photo_url)
    if (ref.current) ref.current.value = ''
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {currentUrl
          ? <img src={currentUrl} alt="" className="h-10 w-10 rounded object-cover" />
          : <div className="h-10 w-10 rounded bg-surface-sunken" />}
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface-raised disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {currentUrl ? 'Replace' : 'Upload'}
        </button>
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPick} />
      </div>
      {err && <p className="text-[11px] text-danger">{err}</p>}
    </div>
  )
}
