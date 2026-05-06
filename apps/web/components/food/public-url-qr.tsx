'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Download, Check } from 'lucide-react'

export function PublicUrlQR({ url, hostelName }: { url: string; hostelName: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [copied,  setCopied]  = useState(false)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 320 })
      .then(d => { if (!cancelled) setDataUrl(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [url])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-text-primary">Public ordering URL</h3>
      <p className="mt-0.5 text-xs text-text-secondary">
        Print the QR code at tables and counters; share the URL on your website or social bio.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="rounded-lg border border-border bg-white p-2">
          {dataUrl
            ? <img src={dataUrl} alt={`Order at ${hostelName}`} className="h-40 w-40" />
            : <div className="h-40 w-40 animate-pulse rounded bg-surface-sunken" />}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-surface-sunken px-2 py-1.5 font-mono text-xs">{url}</code>
            <button type="button" onClick={copy}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-surface-raised">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {dataUrl && (
            <a href={dataUrl} download={`order-qr-${hostelName.replace(/\s+/g, '-').toLowerCase()}.png`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg hover:bg-brand-hover">
              <Download className="h-3.5 w-3.5" /> Download QR (PNG)
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
