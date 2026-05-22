import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { KEYS, getPref, setPref } from './storage'
import { log } from './log'

const PORTAL_BASE = 'https://app.gh-hostels.com'

interface Theme {
  tenant_name?:   string
  logo_url?:      string
  primary_color?: string
}

/**
 * Apply cached theme at cold-start so the status bar tints to the
 * tenant brand before any network round-trip. Non-blocking.
 */
export async function applyCachedTheme(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const color = await getPref(KEYS.TENANT_PRIMARY_COLOR)
  if (color) await tintStatusBar(color)
}

/**
 * Fetch fresh theme post-login; persist for next cold-launch.
 * Best-effort — failure leaves the cached color in place.
 */
export async function refreshTheme(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const res = await fetch(`${PORTAL_BASE}/api/mobile/tenant-theme`, { credentials: 'include' })
    if (!res.ok) return
    const t = (await res.json()) as Theme
    if (t.primary_color) {
      await setPref(KEYS.TENANT_PRIMARY_COLOR, t.primary_color)
      await tintStatusBar(t.primary_color)
    }
    if (t.logo_url)    await setPref(KEYS.TENANT_LOGO_URL, t.logo_url)
    if (t.tenant_name) await setPref(KEYS.TENANT_NAME,     t.tenant_name)
  } catch (err) {
    log.warn('theme: refresh failed', { err: String(err) })
  }
}

async function tintStatusBar(hex: string): Promise<void> {
  try {
    await StatusBar.setBackgroundColor({ color: hex })
    await StatusBar.setStyle({ style: isDark(hex) ? Style.Dark : Style.Light })
  } catch (err) {
    log.warn('status-bar: tint failed', { err: String(err) })
  }
}

/** Pick contrasting status-bar foreground based on a hex luminance heuristic. */
function isDark(hex: string): boolean {
  const m = hex.replace('#', '').match(/.{2}/g)
  if (!m || m.length < 3) return false
  const [r, g, b] = m.map(c => parseInt(c, 16))
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return l < 0.55
}
