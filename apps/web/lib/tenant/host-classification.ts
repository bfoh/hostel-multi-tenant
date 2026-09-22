/**
 * Classifies an incoming request hostname relative to the platform's
 * configured app domain. Shared by middleware.ts's subdomain-redirect
 * guard so the "is this the mobile app's fixed host" check has exactly
 * one definition instead of being re-derived (and potentially drifting)
 * in every place that needs it.
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
export interface HostClassification {
  hostBase: string
  rootDomain: string
  isLocalDev: boolean
  isFixedAppHost: boolean
  /** True when this host is the bare root domain or its www. alias — the
   *  case that *should* redirect an authenticated user to their tenant
   *  subdomain. Always false for the fixed app host and for local dev. */
  isRedirectableRootDomain: boolean
}

export function classifyHost(hostname: string, appDomainEnv: string | undefined): HostClassification {
  const appDomain = (appDomainEnv ?? 'gh-hostels.com').replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const hostBase  = hostname.split(':')[0].toLowerCase()
  const isLocalDev = hostBase === 'localhost' || hostBase === '127.0.0.1'
  const rootDomain = appDomain.startsWith('app.') ? appDomain.slice(4) : appDomain
  const isFixedAppHost = hostBase === `app.${rootDomain}`
  const isRedirectableRootDomain =
    !isLocalDev && !isFixedAppHost && (hostBase === rootDomain || hostBase === `www.${rootDomain}`)

  return { hostBase, rootDomain, isLocalDev, isFixedAppHost, isRedirectableRootDomain }
}
