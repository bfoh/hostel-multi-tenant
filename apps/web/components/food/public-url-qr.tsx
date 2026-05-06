'use client'

import { useState } from 'react'
import { Copy, Download, Check } from 'lucide-react'

/**
 * QR data URL is generated server-side (in the page) and passed in as a prop.
 * Avoids pulling the `qrcode` lib into the client bundle, which had been
 * blowing up at hydration on /food/menu and breaking every button on the page.
 */
export function PublicUrlQR({ url, qrDataUrl, hostelName }: {
  url:        string
  qrDataUrl:  string | null
  hostelName: string
}) {
  const [copied, setCopied] = useState(false)

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
          {qrDataUrl
            ? <img src={qrDataUrl} alt={`Order at ${hostelName}`} className="h-40 w-40" />
            : <div className="flex h-40 w-40 items-center justify-center text-[10px] text-text-tertiary">QR unavailable</div>}
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
          {qrDataUrl && (
            <a href={qrDataUrl} download={`order-qr-${hostelName.replace(/\s+/g, '-').toLowerCase()}.png`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg hover:bg-brand-hover">
              <Download className="h-3.5 w-3.5" /> Download QR (PNG)
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
