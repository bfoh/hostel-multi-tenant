import { createAdminClient } from '@/lib/supabase/admin'
import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'
import { createHmac } from 'crypto'

/**
 * Outgoing webhook headers. These were first written as 'X-GH Hostels-Event'
 * / 'X-GH Hostels-Sig' — a space isn't legal in an HTTP header name, so
 * fetch() threw before sending and every delivery was logged as failed.
 * Hyphenated, they're the documented names made valid; receivers verify
 * the signature header as `sha256=<hex HMAC-SHA256 of the raw body>` keyed
 * by the endpoint secret.
 */
export const WEBHOOK_EVENT_HEADER = 'X-GH-Hostels-Event'
export const WEBHOOK_SIGNATURE_HEADER = 'X-GH-Hostels-Sig'

/**
 * Events an endpoint can subscribe to. booking.cancelled is sent directly by
 * lib/bookings/cancel-booking.ts; the rest are queued by the database
 * triggers in migration 147 and sent by deliverPendingWebhooks().
 */
export const WEBHOOK_EVENT_TYPES = [
  '*',
  'booking.created', 'booking.confirmed', 'booking.checked_in', 'booking.checked_out', 'booking.cancelled',
  'payment.received',
  'maintenance.created', 'maintenance.resolved',
  'occupant.created',
] as const

/**
 * Fire an event to all active webhook endpoints subscribed to eventType.
 * Non-blocking — failures are logged but don't throw.
 */
export async function fireWebhook(
  tenantId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  const supabase = createTenantAdminClient(tenantId)

  const { data: endpoints } = await supabase
    .from('webhook_endpoints')
    .select('id, url, secret, events')
    .eq('is_active', true)

  if (!endpoints?.length) return

  const body = JSON.stringify({ event: eventType, tenant_id: tenantId, data: payload, timestamp: new Date().toISOString() })

  await Promise.allSettled(
    endpoints
      .filter((ep) => (ep.events as string[]).includes(eventType) || (ep.events as string[]).includes('*'))
      .map(async (ep) => {
        const result = await postSigned(ep.url, ep.secret, eventType, body)
        const status = result.ok ? 'delivered' : 'failed'

        await (supabase as any).from('webhook_events').insert({
          tenant_id:        tenantId,
          endpoint_id:      ep.id,
          event_type:       eventType,
          payload:          { event: eventType, data: payload },
          status,
          attempts:         1,
          response_status:  result.responseStatus,
          response_body:    result.responseBody?.slice(0, 500),
          last_attempted_at: new Date().toISOString(),
          delivered_at:     status === 'delivered' ? new Date().toISOString() : null,
        })
      })
  )
}

type DeliveryResult = { ok: boolean; responseStatus: number | null; responseBody: string | null }

async function postSigned(url: string, secret: string | null, eventType: string, body: string): Promise<DeliveryResult> {
  const sig = createHmac('sha256', secret ?? '').update(body).digest('hex')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':           'application/json',
        [WEBHOOK_EVENT_HEADER]:     eventType,
        [WEBHOOK_SIGNATURE_HEADER]: `sha256=${sig}`,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    return { ok: res.ok, responseStatus: res.status, responseBody: await res.text().catch(() => null) }
  } catch {
    return { ok: false, responseStatus: null, responseBody: null }
  }
}

/** Attempts per queued event before it is marked failed (see claim_webhook_events). */
export const MAX_WEBHOOK_ATTEMPTS = 6

type ClaimedEvent = {
  id: string
  tenant_id: string
  endpoint_id: string
  event_type: string
  payload: { event?: string; data?: Record<string, unknown> } | null
  attempts: number
  created_at: string
  url: string
  secret: string | null
  is_active: boolean
}

/**
 * Sends the events that database triggers queued in webhook_events
 * (migration 147). Each claimed event is posted once per run; a failed
 * delivery stays 'pending' for a backed-off retry until MAX_WEBHOOK_ATTEMPTS.
 * The body matches fireWebhook's, plus the event id so receivers can drop
 * repeats — delivery is at least once.
 */
export async function deliverPendingWebhooks(limit = 50) {
  const admin = createAdminClient() as any
  const { data, error } = await admin.rpc('claim_webhook_events', { p_limit: limit })
  if (error) throw new Error(`claim_webhook_events failed: ${error.message}`)

  const events = (data ?? []) as ClaimedEvent[]
  const counts = { claimed: events.length, delivered: 0, retrying: 0, failed: 0 }

  await Promise.allSettled(
    events.map(async (ev) => {
      const now = new Date().toISOString()
      let result: DeliveryResult
      if (ev.is_active) {
        const body = JSON.stringify({
          id:        ev.id,
          event:     ev.event_type,
          tenant_id: ev.tenant_id,
          data:      ev.payload?.data ?? {},
          timestamp: ev.created_at,
        })
        result = await postSigned(ev.url, ev.secret, ev.event_type, body)
      } else {
        result = { ok: false, responseStatus: null, responseBody: 'Endpoint paused' }
      }

      const status = result.ok
        ? 'delivered'
        : !ev.is_active || ev.attempts >= MAX_WEBHOOK_ATTEMPTS ? 'failed' : 'pending'
      counts[status === 'delivered' ? 'delivered' : status === 'failed' ? 'failed' : 'retrying']++

      await admin.from('webhook_events').update({
        status,
        response_status: result.responseStatus,
        response_body:   result.responseBody?.slice(0, 500) ?? null,
        delivered_at:    result.ok ? now : null,
      }).eq('id', ev.id).eq('tenant_id', ev.tenant_id)
    })
  )

  return counts
}
