'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Eye, EyeOff, RefreshCw, Check, AlertTriangle, ExternalLink } from 'lucide-react'

interface Props {
  webhookUrl: string
  secret:     string
  websiteUrl: string | null
}

export function EnquiryWebhookClient({ webhookUrl, secret, websiteUrl }: Props) {
  const router = useRouter()
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied]     = useState<string | null>(null)
  const [rotating, setRotating] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500)
    } catch {
      setError('Could not copy to clipboard')
    }
  }

  async function rotate() {
    if (!confirm('Rotate the webhook secret? Any existing integrations will stop working until you paste the new secret into them.')) {
      return
    }
    setRotating(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/enquiry-webhook/rotate', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Rotation failed')
      router.refresh()
      setRevealed(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rotation failed')
    } finally {
      setRotating(false)
    }
  }

  const masked = secret ? `${secret.slice(0, 4)}${'•'.repeat(24)}${secret.slice(-4)}` : ''

  return (
    <div className="space-y-5">
      {/* Webhook URL */}
      <Field
        label="Webhook URL"
        help="The endpoint your form service should POST enquiries to."
      >
        <div className="flex gap-2">
          <input
            readOnly
            value={webhookUrl}
            className="flex-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm font-mono text-text-primary"
            onFocus={(e) => e.currentTarget.select()}
          />
          <CopyButton label="url" copied={copied} onClick={() => copy('url', webhookUrl)} />
        </div>
      </Field>

      {/* Secret */}
      <Field
        label="Shared secret"
        help="Send this in an `x-enquiry-secret` HTTP header, an `Authorization: Bearer <secret>` header, or a `?secret=<value>` query string."
      >
        <div className="flex gap-2">
          <input
            readOnly
            value={revealed ? secret : masked}
            className="flex-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm font-mono text-text-primary"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-text-secondary hover:text-text-primary transition-colors"
            title={revealed ? 'Hide' : 'Reveal'}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <CopyButton label="secret" copied={copied} onClick={() => copy('secret', secret)} />
          <button
            type="button"
            onClick={rotate}
            disabled={rotating}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${rotating ? 'animate-spin' : ''}`} />
            {rotating ? 'Rotating…' : 'Rotate'}
          </button>
        </div>
      </Field>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Setup guide */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Setup guide</h2>

        <Step n={1} title="Open your form-service dashboard">
          <p className="text-sm text-text-secondary">
            Most no-code builders (Readdy.ai, FormBold, Webflow, Framer) let you forward
            form submissions to a webhook. Look for <em>Webhooks</em>, <em>Integrations</em>,
            or <em>Notifications</em>.
          </p>
        </Step>

        <Step n={2} title="Add a new webhook">
          <ul className="text-sm text-text-secondary space-y-1">
            <li><strong>URL:</strong> the Webhook URL above</li>
            <li><strong>Method:</strong> POST</li>
            <li><strong>Content type:</strong> JSON or form-urlencoded (either is fine)</li>
            <li><strong>Header:</strong> <code className="text-xs">x-enquiry-secret</code> = secret above. If the service can't send custom headers, append <code className="text-xs">?secret=&lt;value&gt;</code> to the URL.</li>
          </ul>
        </Step>

        <Step n={3} title="Map fields (or use these names)">
          <p className="text-sm text-text-secondary mb-2">
            Use these field names in your form, or map your existing names to them:
          </p>
          <ul className="text-xs text-text-secondary font-mono space-y-0.5">
            <li>full_name <span className="text-text-tertiary">(also accepts: name)</span></li>
            <li>phone <span className="text-text-tertiary">(also: phone_number)</span></li>
            <li>email</li>
            <li>preferred_move_in <span className="text-text-tertiary">(also: move_in_date) — YYYY-MM-DD</span></li>
            <li>room_of_interest <span className="text-text-tertiary">(also: room_type)</span></li>
            <li>message <span className="text-text-tertiary">(also: enquiry, notes)</span></li>
          </ul>
        </Step>

        <Step n={4} title="Test it">
          <p className="text-sm text-text-secondary mb-2">
            Submit a test enquiry through your live form. It should appear on the{' '}
            <a href="/waiting-list?source=website" className="text-brand underline">
              Waiting List
            </a>{' '}
            within a few seconds. You'll also get an email + SMS notification.
          </p>
        </Step>
      </div>

      {/* Browser-direct alternative */}
      {websiteUrl && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-2">
            Alternative: browser-direct fetch
          </h2>
          <p className="text-sm text-text-secondary mb-3">
            If your form is hand-coded and you'd rather POST directly from the browser
            (no shared secret), use the CORS-gated endpoint instead. It only accepts requests
            whose <code className="text-xs">Origin</code> matches your saved Website URL
            ({websiteUrl}).
          </p>
          <code className="block rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-mono text-text-primary break-all">
            POST {webhookUrl.replace('/api/webhooks/enquiry/', '/api/public/').replace(/\/[^/]+$/, (m) => `${m}/enquiry`)}
          </code>
          <p className="mt-2 text-xs text-text-tertiary inline-flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            See <code>docs/external-enquiry-snippet.md</code> for a ready-to-paste snippet.
          </p>
        </div>
      )}
    </div>
  )
}

function Field({ label, help, children }: { label: string; help: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-text-primary">{label}</label>
      {children}
      <p className="text-xs text-text-tertiary">{help}</p>
    </div>
  )
}

function CopyButton({ label, copied, onClick }: { label: string; copied: string | null; onClick: () => void }) {
  const active = copied === label
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
      title="Copy"
    >
      {active ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {active ? 'Copied' : 'Copy'}
    </button>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-brand-fg text-xs font-bold">
        {n}
      </span>
      <div className="flex-1">
        <p className="text-sm font-medium text-text-primary mb-1">{title}</p>
        {children}
      </div>
    </div>
  )
}
