'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Browser push notification toggle.
 * Registers/unregisters a push subscription via /api/push/subscribe.
 * Shows a disabled pill with a hint when the browser or VAPID key isn't
 * available, so the row stays visually consistent with the other channel
 * toggles (SMS / Email / Mobile Money).
 */
export function PushToggle() {
  const [supported,  setSupported]  = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !vapidKey) {
      setLoading(false)
      return
    }
    setSupported(true)

    navigator.serviceWorker.register('/sw.js')
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription()
        setSubscribed(!!sub)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [vapidKey])

  async function toggle() {
    if (!supported || loading) return
    setLoading(true)
    setError(null)

    try {
      const reg = await navigator.serviceWorker.ready

      if (subscribed) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await sub.unsubscribe()
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
        }
        setSubscribed(false)
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setError('Notification permission denied. Enable notifications in your browser settings.')
          return
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey!) as unknown as BufferSource,
        })
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
        })
        setSubscribed(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update push notification settings')
    } finally {
      setLoading(false)
    }
  }

  const checked  = subscribed
  const disabled = !supported || loading

  return (
    <label
      className={`flex items-start gap-4 rounded-xl border border-border bg-surface p-4 transition-colors ${
        disabled ? 'cursor-not-allowed opacity-90' : 'cursor-pointer hover:bg-surface-raised'
      }`}
    >
      <div className="flex-1">
        <p className="text-sm font-medium text-text-primary">
          {checked ? 'Push notifications enabled' : 'Enable push notifications'}
        </p>
        <p className="mt-0.5 text-xs text-text-secondary">
          Receive browser alerts for critical anomalies, new bookings, and payment events — even when this tab is closed.
        </p>
        {!supported && !loading && (
          <p className="mt-1 text-[11px] text-text-tertiary">
            Not supported in this browser, or push isn&apos;t configured for this hostel.
          </p>
        )}
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={toggle}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
          checked ? 'bg-brand' : 'bg-border'
        }`}
      >
        {loading ? (
          <Loader2 className="absolute inset-0 m-auto h-3 w-3 animate-spin text-text-secondary" />
        ) : (
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
              checked ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        )}
      </button>
    </label>
  )
}

// Converts base64url VAPID public key to Uint8Array for PushManager.subscribe
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
