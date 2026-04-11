'use client'

import { useState, useEffect } from 'react'
import { Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'

interface Props {
  slug:          string
  initialDomain: string | null
}

type VerifyState = { verified: boolean | null; misconfigured?: boolean; verification?: Array<{ type: string; domain: string; value: string; reason: string }>; reason?: string; warning?: string }

export function DomainForm({ slug, initialDomain }: Props) {
  const [domain,      setDomain]      = useState(initialDomain ?? '')
  const [saving,      setSaving]      = useState(false)
  const [removing,    setRemoving]    = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')
  const [verifying,   setVerifying]   = useState(false)
  const [verifyState, setVerifyState] = useState<VerifyState | null>(null)

  useEffect(() => {
    if (initialDomain) checkVerification()
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!domain.trim()) return
    setSaving(true); setError(''); setSuccess('')
    try {
      const res  = await fetch('/api/settings/domain', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ custom_domain: domain.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save')
      setSuccess(data.warning ?? 'Domain saved. Configure DNS as shown below, then click Verify.')
      checkVerification()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function removeDomain() {
    if (!confirm('Remove this custom domain?')) return
    setRemoving(true); setError(''); setSuccess('')
    try {
      const res  = await fetch('/api/settings/domain', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ custom_domain: null }),
      })
      if (!res.ok) throw new Error('Failed to remove domain')
      setDomain('')
      setVerifyState(null)
      setSuccess('Custom domain removed. Your site is now served from the default subdomain.')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRemoving(false)
    }
  }

  async function checkVerification() {
    setVerifying(true)
    try {
      const res  = await fetch('/api/settings/domain')
      const data = await res.json()
      setVerifyState(data)
    } finally {
      setVerifying(false)
    }
  }

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
  const defaultSubdomain = `${slug}.${appDomain}`
  const saved = initialDomain || (success && domain)

  return (
    <div className="space-y-6">
      {error   && <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>}
      {success && <p className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">{success}</p>}

      {/* Default subdomain */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          <div>
            <p className="text-sm font-semibold text-text-primary">Default subdomain</p>
            <p className="text-sm font-mono text-brand">{defaultSubdomain}</p>
          </div>
        </div>
        <p className="text-xs text-text-secondary">
          This subdomain is always active and requires no DNS configuration.
        </p>
      </div>

      {/* Custom domain */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">Custom domain</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            Point your own domain (e.g. <span className="font-mono">admin.acaciahostel.com</span>) to fully white-label your hostel app — no &quot;gh-hostels&quot; in the URL.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-mono text-text-primary placeholder-text-tertiary focus:border-brand focus:outline-none transition-colors"
            value={domain}
            onChange={e => setDomain(e.target.value)}
            placeholder="book.yourhostel.com"
          />
          <button
            onClick={save}
            disabled={saving || !domain.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </button>
          {initialDomain && (
            <button
              onClick={removeDomain}
              disabled={removing}
              className="flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
              title="Remove custom domain"
            >
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Verification badge */}
        {saved && (
          <div className="flex items-center gap-2">
            {verifyState === null || verifying ? (
              <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
            ) : verifyState.verified ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-danger" />
            )}
            <span className="text-sm text-text-secondary">
              {verifying
                ? 'Checking…'
                : verifyState?.verified
                ? 'Domain verified and active'
                : verifyState?.verified === null
                ? verifyState.reason
                : 'Not yet verified — configure DNS below'}
            </span>
            <button
              onClick={checkVerification}
              disabled={verifying}
              className="ml-auto flex items-center gap-1 text-xs text-brand hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
        )}
      </div>

      {/* DNS instructions */}
      {domain && (
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-text-primary">DNS Configuration Required</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                Add the following DNS record with your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.).
                DNS changes can take up to 48 hours to propagate.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-raised">
                <tr>
                  {['Type', 'Name / Host', 'Value / Points to', 'TTL'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2.5 font-mono text-xs font-bold text-text-primary">CNAME</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-text-primary">
                    {domain.split('.').length > 2
                      ? domain.split('.')[0]  // subdomain: use just the left part
                      : '@'
                    }
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-text-primary">cname.vercel-dns.com</td>
                  <td className="px-3 py-2.5 text-xs text-text-secondary">3600</td>
                </tr>
              </tbody>
            </table>
          </div>

          {verifyState?.verification && verifyState.verification.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-text-primary">Additional verification records required:</p>
              {verifyState.verification.map((v, i) => (
                <div key={i} className="rounded-lg border border-warning/20 bg-warning/5 px-3 py-2 text-xs space-y-1">
                  <p className="font-mono font-bold text-text-primary">{v.type} — {v.domain}</p>
                  <p className="font-mono text-text-secondary break-all">{v.value}</p>
                  <p className="text-warning">{v.reason}</p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-text-secondary space-y-1">
            <p className="font-medium text-text-primary">Using Cloudflare?</p>
            <p>Set the CNAME proxy status to <span className="font-mono font-bold">DNS only</span> (grey cloud) — not Proxied (orange cloud) — so Vercel can issue your SSL certificate.</p>
          </div>
        </div>
      )}

      {/* VERCEL_TOKEN env note */}
      <div className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-xs text-text-secondary space-y-1">
        <p className="font-medium text-text-primary">Production setup</p>
        <p>Set <span className="font-mono">VERCEL_TOKEN</span>, <span className="font-mono">VERCEL_PROJECT_ID</span>, and optionally <span className="font-mono">VERCEL_TEAM_ID</span> in your Vercel project environment variables to enable automatic domain registration via the Vercel API.</p>
      </div>
    </div>
  )
}
