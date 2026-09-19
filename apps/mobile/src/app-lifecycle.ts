import { App, type AppState } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { log } from './log'

/**
 * Forces a fresh webview load after the app returns from the background,
 * so realtime messaging (Supabase Realtime WebSocket) and any other
 * live-updating screen comes back in a known-good state instead of a
 * possibly-stale one.
 *
 * Why this is needed at all: on iOS in particular, backgrounding a
 * Capacitor app generally suspends the WKWebView's JS execution — any
 * timers, heartbeats, or WebSocket keep-alives that Realtime's client
 * relies on to detect and recover from a dropped connection simply don't
 * run while suspended. The client *will* eventually notice on its own
 * heartbeat check after resuming, but that can take up to its heartbeat
 * interval, during which the messaging screen looks connected but isn't
 * actually receiving anything live — silently undermining the one thing
 * "messaging on the go" needs to actually work.
 *
 * A full reload is the simplest fix that doesn't depend on guessing
 * Supabase-internal reconnect timing: it re-establishes every connection
 * from scratch, guaranteed. Only doing it after a long-enough background
 * period avoids a jarring reload on every brief app-switch (checking a
 * notification, answering a call) where the connection likely survived
 * fine.
 */
const RELOAD_AFTER_BACKGROUND_MS = 60_000

let backgroundedAt: number | null = null

export function setupAppLifecycle(): void {
  if (!Capacitor.isNativePlatform()) return

  App.addListener('appStateChange', (state: AppState) => {
    if (!state.isActive) {
      backgroundedAt = Date.now()
      log.info('lifecycle: backgrounded')
      return
    }

    // Resumed.
    const wasBackgroundedFor = backgroundedAt ? Date.now() - backgroundedAt : 0
    backgroundedAt = null

    if (wasBackgroundedFor >= RELOAD_AFTER_BACKGROUND_MS) {
      log.info('lifecycle: resumed after long background, reloading webview', {
        backgroundedMs: wasBackgroundedFor,
      })
      window.location.reload()
      return
    }

    // Short background — connections likely survived. Still nudge any code
    // that listens for standard web visibility signals (Capacitor webviews
    // don't reliably fire these on their own across app state transitions).
    log.info('lifecycle: resumed after short background, dispatching visibility nudge', {
      backgroundedMs: wasBackgroundedFor,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
  })
}
