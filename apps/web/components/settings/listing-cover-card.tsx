'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2 } from 'lucide-react'
import { downscaleImage } from '@/lib/downscale-image'

/**
 * Cover photo for the public listing (tenants.hero_image_url): the photo
 * marketplace cards and the listing gallery lead with. Owners and managers
 * upload or replace it here; the file is resized in the browser first, so
 * a phone photo uploads quickly and stays under the bucket's 5 MB limit.
 */
export function ListingCoverCard({ initialUrl, propertyName }: { initialUrl: string | null; propertyName: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState(initialUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function onPick(file: File | undefined) {
    if (!file) return
    setError(''); setSaved(false)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Use a JPEG, PNG or WebP photo. On iPhone, choose "Most Compatible" in Camera settings or share the photo as JPEG.')
      return
    }
    setBusy(true)
    try {
      const resized = await downscaleImage(file)
      if (!resized) throw new Error('This photo could not be read. Try a JPEG, PNG or WebP photo.')
      const body = new FormData()
      body.append('photo', resized, 'cover.jpg')
      const res = await fetch('/api/settings/listing/cover', { method: 'POST', body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Upload failed. Please try again.')
      setUrl(data.hero_image_url)
      setSaved(true)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Please try again.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">Cover photo</h2>
        <p className="mt-0.5 text-sm text-text-secondary">
          The first photo guests see on the marketplace and at the top of your listing. Use a landscape photo of the building or its best room.
        </p>
      </div>

      <div className="aspect-[3/2] w-full max-w-md overflow-hidden rounded-lg border border-border bg-surface-raised">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Cover photo of ${propertyName}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center text-sm text-text-secondary">
            <ImagePlus className="h-6 w-6" aria-hidden="true" />
            No cover photo yet
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label
          aria-disabled={busy}
          className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover focus-within:ring-2 focus-within:ring-brand/25 ${busy ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => onPick(e.target.files?.[0])}
            disabled={busy}
          />
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
          {busy ? 'Uploading…' : url ? 'Replace cover photo' : 'Upload cover photo'}
        </label>
        <span className="text-xs text-text-secondary">JPEG, PNG or WebP. Large photos are resized for you.</span>
      </div>

      <p aria-live="polite" className="text-sm">
        {error && <span className="text-danger">{error}</span>}
        {saved && !error && <span className="text-success">Cover photo updated. It shows on your listing now.</span>}
      </p>
    </div>
  )
}
