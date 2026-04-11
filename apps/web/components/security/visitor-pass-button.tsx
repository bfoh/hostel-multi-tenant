'use client'

import { useState } from 'react'
import { QrCode, X, Loader2 } from 'lucide-react'

interface PassData {
  visitor: { visitor_name: string; host_name: string | null; purpose: string | null; pass_status: string }
  qrDataUrl: string
  scanUrl: string
}

export function VisitorPassButton({ visitorId }: { visitorId: string }) {
  const [open, setOpen]     = useState(false)
  const [pass, setPass]     = useState<PassData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function openPass() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/security/visitors/${visitorId}/pass`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate pass')
      setPass(data)
      setOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={openPass}
        disabled={loading}
        title="Generate visitor pass"
        className="p-1.5 text-text-tertiary hover:text-brand transition-colors"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
      </button>

      {error && <span className="text-xs text-danger">{error}</span>}

      {open && pass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs rounded-xl border border-border bg-surface p-6 shadow-xl text-center">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-text-primary">Visitor Pass</h2>
              <button onClick={() => setOpen(false)} className="text-text-disabled hover:text-text-primary">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-lg font-bold text-text-primary">{pass.visitor.visitor_name}</p>
            {pass.visitor.host_name && (
              <p className="text-sm text-text-secondary">Visiting: {pass.visitor.host_name}</p>
            )}
            {pass.visitor.purpose && (
              <p className="text-xs text-text-tertiary capitalize mb-4">{pass.visitor.purpose.replace(/_/g, ' ')}</p>
            )}

            <div className="flex justify-center my-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pass.qrDataUrl} alt="Visitor QR pass" className="h-48 w-48 rounded-lg" />
            </div>

            <p className="text-xs text-text-tertiary mb-4">
              Guard scans this code to log entry. Code is single-use.
            </p>

            <p className={`text-xs font-semibold capitalize rounded-full px-3 py-1 inline-block ${
              pass.visitor.pass_status === 'used' ? 'bg-surface-raised text-text-tertiary' :
              pass.visitor.pass_status === 'revoked' ? 'bg-danger/10 text-danger' :
              'bg-success/10 text-success'
            }`}>
              {pass.visitor.pass_status}
            </p>

            <div className="mt-4">
              <button
                onClick={() => window.print()}
                className="w-full rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors"
              >
                Print pass
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
