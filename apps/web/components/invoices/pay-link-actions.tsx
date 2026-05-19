'use client'

import { useState } from 'react'
import { Loader2, Link2, Copy, Mail, MessageSquare, ExternalLink, X } from 'lucide-react'

interface Props {
  bookingId:       string
  balance:         number       // pesewas
  occupantEmail:   string | null
  occupantPhone:   string | null
  paystackEnabled: boolean
}

function ghs(pesewas: number) {
  return `GH₵ ${(pesewas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

export function InvoicePayLinkActions({
  bookingId,
  balance,
  occupantEmail,
  occupantPhone,
  paystackEnabled,
}: Props) {
  const [open, setOpen]       = useState(false)
  const [sendSms, setSendSms] = useState(!!occupantPhone)
  const [sendEmail, setSendEmail] = useState(!!occupantEmail)
  const [overrideEmail, setOverrideEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [result, setResult]   = useState<{ url: string; smsSent: boolean; emailSent: boolean } | null>(null)
  const [copied, setCopied]   = useState(false)

  if (!paystackEnabled || balance <= 0) return null

  async function generate() {
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/payments/paystack/pay-link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          booking_id: bookingId,
          amount:     balance,
          email:      overrideEmail || undefined,
          send_sms:   sendSms,
          send_email: sendEmail,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to create link')
      setResult({
        url:       data.authorization_url,
        smsSent:   !!data.sms_sent,
        emailSent: !!data.email_sent,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable */ }
  }

  function reset() {
    setOpen(false); setResult(null); setError(null); setOverrideEmail('')
  }

  return (
    <div className="print:hidden">
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-xs font-semibold text-success-fg hover:opacity-90 transition-opacity"
      >
        <Link2 className="h-3.5 w-3.5" />
        Send pay link · {ghs(balance)}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-text-primary">Send pay link</h3>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  Balance due: {ghs(balance)} · Mobile Money · Card · Bank Transfer
                </p>
              </div>
              <button onClick={reset} className="rounded p-1 text-text-tertiary hover:bg-surface-raised" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            {!result && (
              <div className="mt-4 space-y-3">
                <label className="flex items-start gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={sendSms}
                    disabled={!occupantPhone}
                    onChange={(e) => setSendSms(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5"
                  />
                  <span>
                    <MessageSquare className="mr-1 inline h-3 w-3" />
                    Send by SMS{' '}
                    {occupantPhone
                      ? <span className="text-text-tertiary">to {occupantPhone}</span>
                      : <span className="text-text-tertiary">— no phone on file</span>}
                  </span>
                </label>

                <label className="flex items-start gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5"
                  />
                  <span>
                    <Mail className="mr-1 inline h-3 w-3" />
                    Send by email{' '}
                    {occupantEmail && !overrideEmail
                      ? <span className="text-text-tertiary">to {occupantEmail}</span>
                      : null}
                  </span>
                </label>

                {sendEmail && (
                  <input
                    type="email"
                    value={overrideEmail}
                    onChange={(e) => setOverrideEmail(e.target.value)}
                    placeholder={occupantEmail ? 'Override email (optional)' : 'Recipient email'}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                )}

                {error && <div className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger">{error}</div>}

                <button
                  onClick={generate}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Generating…' : `Generate pay link · ${ghs(balance)}`}
                </button>
              </div>
            )}

            {result && (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-success/30 bg-success-subtle px-3 py-2 text-xs text-success">
                  Pay link ready
                  {result.smsSent ? ' · SMS sent' : ''}
                  {result.emailSent ? ' · Email sent' : ''}
                </div>

                <div className="flex gap-2">
                  <input
                    readOnly
                    value={result.url}
                    className="flex-1 rounded-md border border-border bg-surface-raised px-2 py-1.5 text-[11px] font-mono"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={copy}
                    className="flex items-center gap-1 rounded-md border border-border bg-surface-raised px-2 py-1.5 text-xs font-medium"
                  >
                    <Copy className="h-3 w-3" />
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="flex gap-2">
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface-sunken transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open
                  </a>
                  <button
                    onClick={reset}
                    className="flex-1 rounded-md bg-brand px-3 py-2 text-xs font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
                  >
                    Done
                  </button>
                </div>

                <p className="text-[11px] text-text-tertiary">
                  Payment will record on this invoice automatically once paid. Refresh the page after the customer confirms.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
