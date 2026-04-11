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
  })
}
