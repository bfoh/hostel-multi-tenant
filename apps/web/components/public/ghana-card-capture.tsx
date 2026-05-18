'use client'

import { useRef, useState } from 'react'
import { Camera, X, Loader2 } from 'lucide-react'

interface Props {
  label: string
  onCapture: (file: File, previewUrl: string) => void
  onClear: () => void
  previewUrl: string | null
}

const MAX_DIM = 1600
const QUALITY = 0.82

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.size < 800 * 1024) return file // skip if already small

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, w, h)

  return new Promise<File>((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return resolve(file)
        resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }))
      },
      'image/jpeg',
      QUALITY,
    )
  })
}

export function GhanaCardCapture({ label, onCapture, onClear, previewUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File) {
    setBusy(true)
    try {
      const compressed = await compressImage(file)
      const url = URL.createObjectURL(compressed)
      onCapture(compressed, url)
    } finally {
      setBusy(false)
    }
  }

  if (previewUrl) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-border bg-surface-sunken">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt={label} className="block w-full h-44 object-cover" />
        <button
          type="button"
          onClick={() => {
            URL.revokeObjectURL(previewUrl)
            onClear()
            if (inputRef.current) inputRef.current.value = ''
          }}
          className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white"
          aria-label="Remove"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-xs text-white">
          {label}
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={busy}
      className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface-sunken text-text-secondary hover:bg-surface-raised transition-colors disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-7 w-7" />}
      <span className="text-sm font-medium">{busy ? 'Processing…' : `Tap to capture ${label}`}</span>
      <span className="text-xs text-text-tertiary">Camera or upload</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />
    </button>
  )
}
