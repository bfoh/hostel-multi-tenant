/**
 * Classifies an incoming request hostname relative to the platform's
 * configured app domain. Shared by middleware.ts's subdomain-redirect
 * guard and by resolveTenant() so "what kind of host is this" has exactly
 * one definition instead of being re-derived (and potentially drifting)
 * in every place that needs it.
 *
 * Domain shape (two verticals sharing one platform):
 *   <domain>                → apex: neutral umbrella landing page
 *   hostels.<domain>        → hostel vertical root: marketplace + marketing
 *   hotels.<domain>         → hotel vertical root: marketplace + marketing
 *   {slug}.hostels.<domain> → a hostel tenant's product host
 *   {slug}.hotels.<domain>  → a hotel tenant's product host
 *   app.<domain>            → the mobile app's fixed host (both verticals)
 *
 * The Capacitor mobile shell is locked to a single fixed host —
 * `app.<domain>` — and never resolves tenant via subdomain (see
 * lib/auth/mobile-context.ts). Its WKWebView treats a redirect to a
 * different origin as an external navigation, handing off to the system
 * browser, which then has no session on the tenant subdomain (cookies are
 * scoped to app.<domain>) and bounces to that subdomain's own /login.
 * Anything that decides whether to redirect an authenticated request to
 * a tenant subdomain must exclude this host.
 */
export type BusinessType = 'hostel' | 'hotel'

export const VERTICALS: BusinessType[] = ['hostel', 'hotel']

/**
 * Derives the bare root domain from a raw APP_DOMAIN-shaped env value —
 * strips a protocol/trailing-slash and, defensively, an `app.` prefix in
 * case the env var was misconfigured with it (the fixed mobile host, not
 * the root, is meant to carry that prefix). Every place that builds a
 * vertical-root or tenant hostname from the env var should go through
 * this rather than re-deriving it inline.
 */
export function bareRootDomain(appDomainEnv: string | undefined): string {
  const appDomain = (appDomainEnv ?? 'aya.com').replace(/^https?:\/\//, '').replace(/\/+$/, '')
  return appDomain.startsWith('app.') ? appDomain.slice(4) : appDomain
}

/** hostel -> "hostels.<domain>", hotel -> "hotels.<domain>" */
export function verticalRootDomain(rootDomain: string, type: BusinessType): string {
  return `${type}s.${rootDomain}`
}

/** A tenant's canonical product host: {slug}.hostels.<domain> or {slug}.hotels.<domain>. */
export function tenantHost(slug: string, type: BusinessType, rootDomain: string): string {
  return `${slug}.${verticalRootDomain(rootDomain, type)}`
}

export interface HostClassification {
  hostBase: string
  rootDomain: string
  isLocalDev: boolean
  isFixedAppHost: boolean
  /** True for the bare apex domain or its www. alias — the neutral umbrella
   *  landing page, not tied to either vertical. */
  isApexDomain: boolean
  /** Which vertical this host is a root of (bare hostels.<domain> or
   *  hotels.<domain>, or its www. alias). Null for the apex, the fixed
   *  mobile host, local dev, or an actual tenant subdomain/custom domain
   *  (those are resolved via DB lookup in resolve.ts, not by string shape). */
  businessType: BusinessType | null
  /** True when this host IS a vertical root itself — the case that
   *  *should* redirect an authenticated user to their tenant subdomain.
   *  Always false for the apex, the fixed app host, and local dev. */
  isRedirectableRootDomain: boolean
}

export function classifyHost(hostname: string, appDomainEnv: string | undefined): HostClassification {
  const hostBase  = hostname.split(':')[0].toLowerCase()
  const isLocalDev = hostBase === 'localhost' || hostBase === '127.0.0.1'
  const rootDomain = bareRootDomain(appDomainEnv)
  const isFixedAppHost = hostBase === `app.${rootDomain}`

  let businessType: BusinessType | null = null
  let isRedirectableRootDomain = false

  if (!isLocalDev && !isFixedAppHost) {
    for (const type of VERTICALS) {
      const vRoot = verticalRootDomain(rootDomain, type)
      if (hostBase === vRoot || hostBase === `www.${vRoot}`) {
        businessType = type
        isRedirectableRootDomain = true
        break
      }
    }
  }

  const isApexDomain =
    !isLocalDev && !isFixedAppHost && !isRedirectableRootDomain &&
    (hostBase === rootDomain || hostBase === `www.${rootDomain}`)

  return { hostBase, rootDomain, isLocalDev, isFixedAppHost, isApexDomain, businessType, isRedirectableRootDomain }
}
