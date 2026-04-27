import { NextResponse } from 'next/server'

// TEMPORARY — delete after debugging
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'MISSING'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'MISSING'
  const appDomain = process.env.APP_DOMAIN ?? 'MISSING'

  return NextResponse.json({
    supabase_url: url,
    // Only show first/last 8 chars of keys — enough to verify without exposing secrets
    anon_key_preview: anonKey === 'MISSING' ? 'MISSING' : `${anonKey.slice(0, 12)}...${anonKey.slice(-8)}`,
    app_domain: appDomain,
    // Provider readiness flags — booleans only, never leak the value itself.
    providers: {
      arkesel_api_key:     !!process.env.ARKESEL_API_KEY,
      arkesel_sender_id:   process.env.ARKESEL_SENDER_ID ?? null,
      resend_api_key:      !!process.env.RESEND_API_KEY,
      resend_from_email:   process.env.RESEND_FROM_EMAIL ?? null,
      anthropic_api_key:   !!process.env.ANTHROPIC_API_KEY,
      paystack_secret_key: !!process.env.PAYSTACK_SECRET_KEY,
      paystack_public_key: !!process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      vapid_public_key:    !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      cron_secret:         !!process.env.CRON_SECRET,
    },
  })
}
