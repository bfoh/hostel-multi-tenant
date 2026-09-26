'use client'

import { useRef, useState } from 'react'
import { Upload, Loader2, X, ImageIcon } from 'lucide-react'

const MAX_PHOTOS = 12

/**
 * Onboarding-time room-type photo picker. Visually mirrors
 * components/rooms/room-photos-upload.tsx, but as a controlled component —
 * there's no room_categories row (and so no server-side image_urls array)
 * to read/write yet during onboarding, so the URL list lives in the
 * wizard's own form state and is only persisted once /api/onboarding/
 * complete creates the real row.
 */
export function RoomPhotosField({ tenantId, value, onChange }: {
  tenantId: string
  value:    string[]
  onChange: (urls: string[]) => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  const onPick: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setErr(null)

    const fd = new FormData()
    fd.set('file', file)
    fd.set('tenantId', tenantId)
    const res = await fetch('/api/onboarding/room-photos', { method: 'POST', body: fd })
    setBusy(false)
    if (ref.current) ref.current.value = ''

    if (!res.ok) {
      const j = await res.json().catch(() => null) as any
      setErr(j?.error ?? 'Upload failed')
      return
    }
    const { url } = await res.json()
    onChange([...value, url])
  }

  async function removePhoto(url: string) {
    setRemoving(url); setErr(null)
    const res = await fetch('/api/onboarding/room-photos', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url, tenantId }),
    })
    setRemoving(null)
    if (!res.ok) {
      const j = await res.json().catch(() => null) as any
      setErr(j?.error ?? 'Failed to remove photo')
      return
    }
    onChange(value.filter((u) => u !== url))
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text-primary">Room photos</p>
      <p className="text-xs text-text-secondary">
        Shown on your public marketplace listing. Up to {MAX_PHOTOS} photos, 4MB each.
      </p>

      <div className="flex flex-wrap gap-3">
        {value.map((url) => (
          <div key={url} className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(url)}
              disabled={removing === url}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100"
              aria-label="Remove photo"
            >
              {removing === url ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            </button>
          </div>
        ))}

        {value.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={busy}
            className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-text-tertiary transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            <span className="text-[11px] font-medium">{busy ? 'Uploading…' : 'Add photo'}</span>
          </button>
        )}

        {value.length === 0 && !busy && (
          <div className="flex h-24 items-center gap-2 px-2 text-xs text-text-tertiary">
            <ImageIcon className="h-4 w-4" />
            No photos yet
          </div>
        )}
      </div>

      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPick} />
      {err && <p className="text-xs text-danger">{err}</p>}
    </div>
  )
}
