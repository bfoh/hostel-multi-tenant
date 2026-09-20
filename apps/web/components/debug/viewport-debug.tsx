'use client'

import { useEffect, useState } from 'react'

/**
 * Temporary diagnostic overlay for tracking down a horizontal-overflow bug
 * specific to the Capacitor iOS WebView (confirmed absent in mobile Safari
 * on the same device/page). Only renders when the URL has ?viewportdebug=1,
 * so it never shows for real users. Remove once the WebView sizing issue is
 * root-caused and fixed.
 */
export function ViewportDebug() {
  const [info, setInfo] = useState<Record<string, string | number> | null>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (!window.location.search.includes('viewportdebug')) return
    setEnabled(true)

    const read = () => {
      const de = document.documentElement
      setInfo({
        'window.innerWidth': window.innerWidth,
        'window.innerHeight': window.innerHeight,
        'document.clientWidth': de.clientWidth,
        'document.scrollWidth': de.scrollWidth,
        'document.clientHeight': de.clientHeight,
        'document.scrollHeight': de.scrollHeight,
        'body.scrollWidth': document.body.scrollWidth,
        devicePixelRatio: window.devicePixelRatio,
        'visualViewport.width': window.visualViewport?.width ?? 'n/a',
        'visualViewport.scale': window.visualViewport?.scale ?? 'n/a',
        userAgent: navigator.userAgent.slice(0, 60),
      })
    }

    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])

  if (!enabled || !info) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: 'rgba(255, 0, 0, 0.92)',
        color: 'white',
        fontSize: 11,
        fontFamily: 'monospace',
        padding: '8px 10px',
        lineHeight: 1.5,
      }}
    >
      {Object.entries(info).map(([k, v]) => (
        <div key={k}>
          {k}: <strong>{String(v)}</strong>
        </div>
      ))}
    </div>
  )
}
