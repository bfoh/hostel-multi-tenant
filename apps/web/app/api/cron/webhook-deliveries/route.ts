import { NextResponse, type NextRequest } from 'next/server'

import { deliverPendingWebhooks } from '@/lib/webhooks'

export async function POST(req: NextRequest) {
  return handle(req)
}
export async function GET(req: NextRequest) {
  return handle(req)
}

/**
 * Sends webhook events queued by the database triggers in migration 147.
 * Called every minute by Supabase Cron (migration 148). Overlapping runs are
 * safe: claim_webhook_events() hands each event to one run only.
 */
async function handle(req: NextRequest) {
  const secret =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    req.nextUrl.searchParams.get('secret')

  // Posts tenant data to external URLs, so it fails closed like the
  // booking-holds sweep when no scheduler secret is configured.
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json(await deliverPendingWebhooks())
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
