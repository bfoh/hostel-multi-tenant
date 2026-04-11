'use client'

import { useState } from 'react'
import { Key, RefreshCw, Trash2, Eye, EyeOff, Loader2, Copy, CheckCircle2 } from 'lucide-react'

interface Props {
  initialKey: string | null
}

export function ApiKeyPanel({ initialKey }: Props) {
  const [apiKey,    setApiKey]    = useState(initialKey)
  const [visible,   setVisible]   = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [error,     setError]     = useState('')

  async function generate() {
    if (apiKey && !confirm('This will invalidate the existing key. Any integrations using it will break. Continue?')) return
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/settings/api-key', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setApiKey(data.key)
      setVisible(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function revoke() {
    if (!confirm('Revoke the API key? All integrations using it will stop working immediately.')) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/settings/api-key', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to revoke')
      setApiKey(null)
      setVisible(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    if (!apiKey) return
    await navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const masked = apiKey ? apiKey.slice(0, 14) + '•'.repeat(apiKey.length - 14) : null

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-danger">{error}</p>}

      {apiKey ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2.5">
            <Key className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
            <code className="flex-1 font-mono text-xs text-text-primary truncate">
              {visible ? apiKey : masked}
            </code>
            <button onClick={() => setVisible(v => !v)} className="text-text-tertiary hover:text-text-primary transition-colors" title={visible ? 'Hide' : 'Show'}>
              {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button onClick={copy} className="text-text-tertiary hover:text-brand transition-colors" title="Copy">
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-raised transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Rotate key
            </button>
            <button
              onClick={revoke}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs font-medium text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Revoke
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-text-tertiary">No API key generated yet.</p>
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
            Generate API key
          </button>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-xs text-text-secondary space-y-1">
        <p className="font-medium text-text-primary">Usage</p>
        <p>Send the key in the <code className="font-mono">X-Api-Key</code> header on requests to <code className="font-mono">/api/public/*</code> endpoints that require authentication.</p>
        <p className="text-warning">Keep this key secret — treat it like a password. Rotate immediately if compromised.</p>
      </div>
    </div>
  )
}
