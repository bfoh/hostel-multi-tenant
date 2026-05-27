/**
 * Rate limiters built on Upstash Redis. Each named limiter targets a class
 * of routes that share a similar abuse profile, so callers don't have to
 * pick numbers per-route.
 *
 * Disabled (open) when UPSTASH_REDIS_REST_URL / TOKEN are missing — so local
 * dev without Upstash is unaffected, while prod (which already has Upstash
 * configured for tenant caching) gets enforcement automatically.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

type Limiter = {
  limit(identifier: string): Promise<{ success: boolean; limit: number; remaining: number; reset: number }>
}

const ALLOW_ALL: Limiter = {
  async limit() {
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  },
}

function buildRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

const redis = buildRedis()

/**
 * Make a Ratelimit instance backed by Upstash, or a permissive stub when
 * Upstash is not configured. The analytics flag publishes hit counts to the
 * Upstash dashboard, which costs one extra command per request — cheap.
 */
function make(prefix: string, limit: number, windowSeconds: number): Limiter {
  if (!redis) return ALLOW_ALL
  return new Ratelimit({
    redis,
    prefix:    `ratelimit:${prefix}`,
    limiter:   Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    analytics: true,
  })
}

/**
 * Auth-class routes: signup, login, password reset, OTP verification.
 * Tight because anything email/SMS-dispatching has a real monetary cost
 * and a successful attack here can lock real users out.
 */
export const authLimiter = make('auth', 5, 60)            // 5 per minute per IP

/**
 * Payment init / pay-link routes. Each call hits Paystack and may persist a
 * pending row, so abuse burns external quota + DB load.
 */
export const paymentLimiter = make('payment', 10, 60)     // 10 per minute per IP

/**
 * Onboarding wizard endpoints + slug-availability checker. Looser than auth
 * because legitimate users genuinely poll while typing a slug.
 */
export const onboardingLimiter = make('onboarding', 30, 60) // 30 per minute per IP

/**
 * Public unauthenticated reads (booking page metadata, room listings).
 * Loose ceiling — enough headroom for legitimate refresh patterns but
 * still caps trivial scraping bots.
 */
export const publicLimiter = make('public', 60, 60)         // 60 per minute per IP

/**
 * Pull a best-effort client identifier. Vercel sets `x-forwarded-for`, and
 * the first hop in that list is the real client IP. Fall back to the
 * request IP or a static bucket so the limiter never crashes.
 */
export function clientId(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'anon'
}

/**
 * Convenience wrapper for handlers: if rate-limited, returns a 429 Response
 * with retry hints; otherwise returns null and the caller proceeds.
 */
export async function enforceRateLimit(
  limiter: Limiter,
  req: NextRequest,
  bucketKey?: string,
): Promise<NextResponse | null> {
  const id = bucketKey ? `${bucketKey}:${clientId(req)}` : clientId(req)
  const { success, limit, remaining, reset } = await limiter.limit(id)
  if (success) return null

  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
  return NextResponse.json(
    { error: 'rate_limited', message: 'Too many requests. Slow down and try again shortly.' },
    {
      status: 429,
      headers: {
        'Retry-After':           String(retryAfter),
        'X-RateLimit-Limit':     String(limit),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset':     String(reset),
      },
    },
  )
}
