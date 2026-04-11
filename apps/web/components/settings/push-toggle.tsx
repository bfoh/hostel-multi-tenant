'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'

/**
 * Browser push notification toggle.
 * Registers/unregisters a push subscription via /api/push/subscribe.
 * Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY env var.
 */
export function PushToggle() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !vapidKey) {
      setLoading(false)
      return
    }

    setSupported(true)

    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [vapidKey])

  async function toggle() {
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
          userVisibleOnly: true,
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

  if (!supported) return null

  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex-1">
        <p className="text-sm font-semibold text-text-primary">
          {subscribed ? 'Push notifications enabled' : 'Enable push notifications'}
        </p>
        <p className="mt-0.5 text-xs text-text-secondary">
          Receive browser alerts for critical anomalies, new bookings, and payment events — even when this tab is closed.
        </p>
        {error && (
          <p className="mt-2 text-xs text-danger">{error}</p>
        )}
      </div>
      <button
        onClick={toggle}
        disabled={loading}
        className={`shrink-0 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
          subscribed
            ? 'bg-danger/10 text-danger hover:bg-danger/20'
            : 'bg-primary text-white hover:bg-primary/90'
        }`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : subscribed ? (
          <><BellOff className="h-4 w-4" /> Disable</>
        ) : (
          <><Bell className="h-4 w-4" /> Enable</>
        )}
      </button>
    </div>
  )
}

// Converts base64url VAPID public key to Uint8Array for PushManager.subscribe
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
