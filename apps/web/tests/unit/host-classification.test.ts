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
 * (the mobile app's fixed host) never does, that only a bare *vertical root*
 * (hostels.<domain> / hotels.<domain>) does, that the neutral apex domain
 * does NOT (it has no vertical of its own to redirect into), and that
 * localhost never does either.
 */
import { describe, expect, it } from 'vitest'
import { classifyHost } from '@/lib/tenant/host-classification'

describe('classifyHost', () => {
  it('marks the fixed app host as not redirectable, not apex, no vertical', () => {
    const result = classifyHost('app.aya.com', 'aya.com')
    expect(result.isFixedAppHost).toBe(true)
    expect(result.isRedirectableRootDomain).toBe(false)
    expect(result.isApexDomain).toBe(false)
    expect(result.businessType).toBeNull()
  })

  it('marks the bare apex domain as apex, but NOT redirectable (no vertical of its own)', () => {
    const result = classifyHost('aya.com', 'aya.com')
    expect(result.isFixedAppHost).toBe(false)
    expect(result.isApexDomain).toBe(true)
    expect(result.isRedirectableRootDomain).toBe(false)
    expect(result.businessType).toBeNull()
  })

  it('marks the apex www. alias as apex too', () => {
    const result = classifyHost('www.aya.com', 'aya.com')
    expect(result.isApexDomain).toBe(true)
    expect(result.isRedirectableRootDomain).toBe(false)
  })

  it('marks the hostel vertical root as redirectable, tagged hostel, not apex', () => {
    const result = classifyHost('hostels.aya.com', 'aya.com')
    expect(result.isRedirectableRootDomain).toBe(true)
    expect(result.businessType).toBe('hostel')
    expect(result.isApexDomain).toBe(false)
  })

  it('marks the hotel vertical root as redirectable, tagged hotel', () => {
    const result = classifyHost('hotels.aya.com', 'aya.com')
    expect(result.isRedirectableRootDomain).toBe(true)
    expect(result.businessType).toBe('hotel')
  })

  it('marks a vertical root www. alias as redirectable too', () => {
    const result = classifyHost('www.hostels.aya.com', 'aya.com')
    expect(result.isRedirectableRootDomain).toBe(true)
    expect(result.businessType).toBe('hostel')
  })

  it('never redirects localhost, even with a port', () => {
    const result = classifyHost('localhost:3000', 'aya.com')
    expect(result.isLocalDev).toBe(true)
    expect(result.isRedirectableRootDomain).toBe(false)
  })

  it('leaves an actual tenant subdomain alone (not fixed, not apex, not a redirectable root — it is already the destination)', () => {
    const result = classifyHost('my-hostel.hostels.aya.com', 'aya.com')
    expect(result.isFixedAppHost).toBe(false)
    expect(result.isApexDomain).toBe(false)
    expect(result.isRedirectableRootDomain).toBe(false)
    expect(result.businessType).toBeNull()
  })

  it('still correctly identifies the fixed app host if APP_DOMAIN is configured with the app. prefix', () => {
    // Defensive case: even if the env var itself were misconfigured as
    // 'app.aya.com' instead of the bare root, the fixed-host check must
    // still match app.aya.com, not app.app.aya.com.
    const result = classifyHost('app.aya.com', 'app.aya.com')
    expect(result.isFixedAppHost).toBe(true)
    expect(result.rootDomain).toBe('aya.com')
  })

  it('defaults to aya.com when no app-domain env var is provided', () => {
    const result = classifyHost('app.aya.com', undefined)
    expect(result.isFixedAppHost).toBe(true)
  })
})
