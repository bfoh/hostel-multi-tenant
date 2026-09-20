'use client'

import { useEffect, useState } from 'react'

/**
 * Temporary diagnostic overlay for tracking down a horizontal-overflow bug
 * specific to the Capacitor iOS WebView (confirmed absent in mobile Safari
 * on the same device/page). Only renders when the URL has ?viewportdebug=1,
 * so it never shows for real users. Remove once the WebView sizing issue is
 * root-caused and fixed.
 *
 * Scans the live DOM for any element wider than the viewport and outlines
 * it in red directly in the running app, so the culprit is visible on the
 * phone screen without needing a working remote Web Inspector session.
 */
export function ViewportDebug() {
  const [info, setInfo] = useState<Record<string, string | number> | null>(null)
  const [culprits, setCulprits] = useState<string[]>([])
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (!window.location.search.includes('viewportdebug')) return
    setEnabled(true)

    const read = () => {
      const de = document.documentElement
      setInfo({
        htmlClassName: de.className.slice(0, 80),
        'html overflowX': getComputedStyle(de).overflowX,
        'body overflowX': getComputedStyle(document.body).overflowX,
        'document.clientWidth': de.clientWidth,
        'document.scrollWidth': de.scrollWidth,
        'body.scrollWidth': document.body.scrollWidth,
        'visualViewport.width': window.visualViewport?.width ?? 'n/a',
      })

      const vw = de.clientWidth
      const found: string[] = []
      document.querySelectorAll<HTMLElement>('*').forEach((el) => {
        if (el.scrollWidth > vw + 1) {
          const rect = el.getBoundingClientRect()
          found.push(
            `${el.tagName}.${String(el.className).slice(0, 40)} sw=${el.scrollWidth} left=${Math.round(rect.left)} width=${Math.round(rect.width)}`
          )
          el.style.outline = '3px solid red'
          el.style.outlineOffset = '-3px'
        }
      })
      setCulprits(found.slice(0, 8))
    }

    read()
    const t = setTimeout(read, 1500) // catch late-loading content
    window.addEventListener('resize', read)
    return () => {
      window.removeEventListener('resize', read)
      clearTimeout(t)
    }
  }, [])

  if (!enabled || !info) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        maxHeight: '70vh',
        overflowY: 'auto',
        zIndex: 99999,
        background: 'rgba(255, 0, 0, 0.92)',
        color: 'white',
        fontSize: 10,
        fontFamily: 'monospace',
        padding: '8px 10px',
        lineHeight: 1.4,
      }}
    >
      {Object.entries(info).map(([k, v]) => (
        <div key={k}>
          {k}: <strong>{String(v)}</strong>
        </div>
      ))}
      <div style={{ marginTop: 6, fontWeight: 'bold' }}>
        Overflowing elements ({culprits.length}) — outlined red on page:
      </div>
      {culprits.length === 0 && <div>(none found)</div>}
      {culprits.map((c, i) => (
        <div key={i}>{c}</div>
      ))}
    </div>
  )
}
