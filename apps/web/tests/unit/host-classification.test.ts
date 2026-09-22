/**
 * Regression guard for the mobile-app cross-origin redirect bug: middleware's
 * subdomain-redirect block was treating app.<domain> as part of "the root
 * domain" and bouncing every authenticated request there to the tenant's
 * subdomain. Inside the Capacitor app that's a cross-origin navigation,
 * which the WKWebView hands off to the system browser — which has no
 * session on the tenant subdomain and bounces to its own /login.
 *
 * classifyHost() is the single source of truth for "should this host
 * redirect to the tenant subdomain" — this test locks in that app.<domain>
 * (the mobile app's fixed host) never does, while the bare root domain and
 * www. alias still do, and localhost never does either.
 */
import { describe, expect, it } from 'vitest'
import { classifyHost } from '@/lib/tenant/host-classification'

describe('classifyHost', () => {
  it('marks the fixed app host as not redirectable, and flags it as fixed', () => {
    const result = classifyHost('app.gh-hostels.com', 'gh-hostels.com')
    expect(result.isFixedAppHost).toBe(true)
    expect(result.isRedirectableRootDomain).toBe(false)
  })

  it('marks the bare root domain as redirectable', () => {
    const result = classifyHost('gh-hostels.com', 'gh-hostels.com')
    expect(result.isFixedAppHost).toBe(false)
    expect(result.isRedirectableRootDomain).toBe(true)
  })

  it('marks the www. alias as redirectable', () => {
    const result = classifyHost('www.gh-hostels.com', 'gh-hostels.com')
    expect(result.isRedirectableRootDomain).toBe(true)
  })

  it('never redirects localhost, even with a port', () => {
    const result = classifyHost('localhost:3000', 'gh-hostels.com')
    expect(result.isLocalDev).toBe(true)
    expect(result.isRedirectableRootDomain).toBe(false)
  })

  it('leaves an actual tenant subdomain alone (not fixed, not redirectable — it is already the destination)', () => {
    const result = classifyHost('my-hostel.gh-hostels.com', 'gh-hostels.com')
    expect(result.isFixedAppHost).toBe(false)
    expect(result.isRedirectableRootDomain).toBe(false)
  })

  it('still correctly identifies the fixed app host if APP_DOMAIN is configured with the app. prefix', () => {
    // Defensive case: even if the env var itself were misconfigured as
    // 'app.gh-hostels.com' instead of the bare root, the fixed-host check
    // must still match app.gh-hostels.com, not app.app.gh-hostels.com.
    const result = classifyHost('app.gh-hostels.com', 'app.gh-hostels.com')
    expect(result.isFixedAppHost).toBe(true)
    expect(result.rootDomain).toBe('gh-hostels.com')
  })

  it('defaults to gh-hostels.com when no app-domain env var is provided', () => {
    const result = classifyHost('app.gh-hostels.com', undefined)
    expect(result.isFixedAppHost).toBe(true)
  })
})
