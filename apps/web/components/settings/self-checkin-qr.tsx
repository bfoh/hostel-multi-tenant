'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Printer, Copy, Check } from 'lucide-react'
import QRCode from 'qrcode'

interface Props {
  checkinUrl: string
  hostelName: string
  logoUrl?: string | null
  primaryColor?: string | null
  contactPhone?: string | null
}

export function SelfCheckinQR({
  checkinUrl,
  hostelName,
  logoUrl,
  primaryColor,
  contactPhone,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dataUrl, setDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(checkinUrl, { width: 800, margin: 2, errorCorrectionLevel: 'H' })
      .then(setDataUrl)
      .catch(() => setDataUrl(''))
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, checkinUrl, { width: 320, margin: 1 }).catch(() => {})
    }
  }, [checkinUrl])

  function downloadPng() {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `self-checkin-qr-${hostelName.replace(/\s+/g, '-').toLowerCase()}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(checkinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  function printPoster() {
    const w = window.open('', '_blank', 'width=900,height=1200')
    if (!w) return
    const color = primaryColor ?? '#7A3B2E'
    w.document.write(`<!doctype html>
<html>
<head>
<title>Self Check-in — ${hostelName}</title>
<style>
  @page { size: A4; margin: 1cm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; color: #111; }
  .poster { padding: 2rem; text-align: center; }
  .brand { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 1.5rem; }
  .brand img { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; }
  .brand-fallback { width: 64px; height: 64px; border-radius: 50%; background: ${color}; }
  h1 { font-size: 2rem; margin: 0; color: #111; }
  h2 { font-size: 1.5rem; margin: 0.5rem 0 2rem 0; color: ${color}; font-weight: 600; }
  .qr { display: inline-block; padding: 1rem; background: #fff; border: 2px solid ${color}; border-radius: 1rem; }
  .qr img { display: block; width: 480px; height: 480px; }
  .scan-hint { font-size: 1.5rem; margin-top: 2rem; font-weight: 700; color: #111; }
  ol { text-align: left; max-width: 480px; margin: 1.5rem auto; font-size: 1rem; color: #333; line-height: 1.6; }
  .url { font-family: monospace; font-size: 0.9rem; margin-top: 2rem; color: #555; word-break: break-all; }
  .contact { margin-top: 1.5rem; font-size: 1rem; color: #444; }
</style>
</head>
<body>
  <div class="poster">
    <div class="brand">
      ${logoUrl
        ? `<img src="${logoUrl}" alt="" />`
        : `<div class="brand-fallback"></div>`}
      <h1>${escapeHtml(hostelName)}</h1>
    </div>
    <h2>Self Check-in</h2>
    <div class="qr">
      <img src="${dataUrl}" alt="Self check-in QR code" />
    </div>
    <p class="scan-hint">Scan to check in</p>
    <ol>
      <li>Open your phone camera and scan the QR code above</li>
      <li>Fill in your details and select a room</li>
      <li>Capture both sides of your Ghana Card</li>
      <li>Pay online and show the booking code to staff</li>
    </ol>
    ${contactPhone ? `<p class="contact">Need help? Call <strong>${escapeHtml(contactPhone)}</strong></p>` : ''}
    <p class="url">${escapeHtml(checkinUrl)}</p>
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`)
    w.document.close()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[auto,1fr]">
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="rounded-lg border border-border bg-white p-4">
          <canvas ref={canvasRef} className="block" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={printPoster}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <Printer className="h-4 w-4" />
            Print poster
          </button>
          <button
            onClick={downloadPng}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors"
          >
            <Download className="h-4 w-4" />
            Download PNG
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-text-secondary">Check-in URL</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-md bg-surface-sunken px-2 py-1.5 text-xs font-mono text-text-primary">
              {checkinUrl}
            </code>
            <button
              onClick={copyLink}
              className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-raised transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-xs text-text-tertiary">
            Anyone with this link or QR code can submit a check-in request.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 text-sm text-text-secondary">
          <p className="mb-2 font-medium text-text-primary">How it works</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Guest scans QR code at the front desk</li>
            <li>Fills name, phone, institution, picks a room</li>
            <li>Captures Ghana Card (front + back)</li>
            <li>Pays online via Paystack (card or MoMo)</li>
            <li>Booking lands in <strong>Bookings → Self check-ins</strong> awaiting your confirmation</li>
            <li>Staff verifies the Ghana Card and confirms the booking</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
