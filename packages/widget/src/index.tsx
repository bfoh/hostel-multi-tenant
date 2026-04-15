/**
 * GH Hostels Booking Widget
 *
 * Usage (floating button):
 *   <script src="https://yourhostel.com/widget.js"
 *           data-hostel="my-hostel-slug"
 *           data-mode="floating"
 *           data-base-url="https://yourhostel.com"></script>
 *
 * Usage (inline):
 *   <div id="booking-widget"></div>
 *   <script src="https://yourhostel.com/widget.js"
 *           data-hostel="my-hostel-slug"
 *           data-mode="inline"
 *           data-target="#booking-widget"
 *           data-base-url="https://yourhostel.com"></script>
 */

import { h, render } from 'preact'
import { useState } from 'preact/hooks'
import { App } from './App'
import { CSS } from './styles'
import { setBaseUrl } from './api'

// ── Inject styles once ─────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('abw-styles')) return
  const style = document.createElement('style')
  style.id = 'abw-styles'
  style.textContent = CSS
  document.head.appendChild(style)
}

// ── Floating mode ──────────────────────────────────────────────────────

function FloatingWidget({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div class="abw-root">
      <button class="abw-fab" onClick={() => setOpen(true)}>
        🏨 Book a Room
      </button>
      {open && (
        <div class="abw-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <App slug={slug} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}

// ── Inline mode ────────────────────────────────────────────────────────

function InlineWidget({ slug }: { slug: string }) {
  return (
    <div class="abw-root abw-inline">
      <App slug={slug} />
    </div>
  )
}

// ── Auto-init from script tag attributes ───────────────────────────────

function init() {
  const script =
    document.currentScript as HTMLScriptElement | null
    ?? document.querySelector('script[data-hostel]') as HTMLScriptElement | null

  if (!script) {
    console.error('[GHHostelsWidget] Cannot find script tag with data-hostel attribute.')
    return
  }

  const slug    = script.getAttribute('data-hostel') ?? ''
  const mode    = script.getAttribute('data-mode') ?? 'floating'
  const baseUrl = script.getAttribute('data-base-url') ?? window.location.origin
  const target  = script.getAttribute('data-target')

  if (!slug) {
    console.error('[GHHostelsWidget] Missing data-hostel attribute.')
    return
  }

  setBaseUrl(baseUrl)
  injectStyles()

  if (mode === 'inline') {
    const container = target
      ? document.querySelector(target)
      : document.getElementById('booking-widget')

    if (!container) {
      console.error('[GHHostelsWidget] Could not find inline target element:', target)
      return
    }

    render(h(InlineWidget, { slug }), container as Element)
  } else {
    // Floating: attach to body
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    render(h(FloatingWidget, { slug }), mount)
  }
}

// ── Programmatic API (window.GHHostelsWidget) ──────────────────────────

;(window as any).GHHostelsWidget = { init, setBaseUrl }

// Auto-init on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
