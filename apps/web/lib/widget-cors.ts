import { NextResponse } from 'next/server'

/**
 * Validate request origin against tenant's allowed widget domains.
 * Returns CORS headers to include in the response.
 * - Empty domains list = allow all (not recommended for production).
 * - '*' is only returned when explicitly open; otherwise reflects the allowed origin.
 */
export function widgetCorsHeaders(
  origin: string | null,
  allowedDomains: string[],
): Record<string, string> {
  const base = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
    'Access-Control-Max-Age': '86400',
  }

  if (!allowedDomains || allowedDomains.length === 0) {
    // Open — allow all origins
    return { ...base, 'Access-Control-Allow-Origin': '*' }
  }

  if (!origin) return base  // no origin header — non-browser request, no CORS needed

  // Strip protocol for comparison
  const originHost = origin.replace(/^https?:\/\//, '').split(':')[0]
  const allowed = allowedDomains.some((d) => {
    const clean = d.replace(/^https?:\/\//, '').split(':')[0]
    // Exact match or subdomain match (www.acme.com matches acme.com)
    return originHost === clean || originHost.endsWith(`.${clean}`)
  })

  if (allowed) {
    return {
      ...base,
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
    }
  }

  return base  // Origin not allowed — no ACAO header → browser blocks it
}

/** Respond to CORS preflight OPTIONS request */
export function corsPreflightResponse(headers: Record<string, string>) {
  return new NextResponse(null, { status: 204, headers })
}

/** Check if origin is allowed, return 403 if not */
export function checkOrigin(origin: string | null, allowedDomains: string[]): boolean {
  if (!allowedDomains || allowedDomains.length === 0) return true
  if (!origin) return true  // Non-browser requests allowed
  const originHost = origin.replace(/^https?:\/\//, '').split(':')[0]
  return allowedDomains.some((d) => {
    const clean = d.replace(/^https?:\/\//, '').split(':')[0]
    return originHost === clean || originHost.endsWith(`.${clean}`)
  })
}
