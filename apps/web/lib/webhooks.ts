import { createAdminClient } from '@/lib/supabase/admin'
import { createHmac } from 'crypto'

/**
 * Fire an event to all active webhook endpoints subscribed to eventType.
 * Non-blocking — failures are logged but don't throw.
 */
export async function fireWebhook(
  tenantId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  const supabase = createAdminClient()

  const { data: endpoints } = await supabase
    .from('webhook_endpoints')
    .select('id, url, secret, events')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (!endpoints?.length) return

  const body = JSON.stringify({ event: eventType, tenant_id: tenantId, data: payload, timestamp: new Date().toISOString() })

  await Promise.allSettled(
    endpoints
      .filter((ep) => (ep.events as string[]).includes(eventType) || (ep.events as string[]).includes('*'))
      .map(async (ep) => {
        const sig = createHmac('sha256', ep.secret ?? '').update(body).digest('hex')
        let status = 'pending'
        let responseStatus: number | null = null
        let responseBody: string | null = null

        try {
          const res = await fetch(ep.url, {
            method: 'POST',
            headers: {
              'Content-Type':           'application/json',
              'X-GH Hostels-Event':   eventType,
              'X-GH Hostels-Sig':     `sha256=${sig}`,
            },
            body,
            signal: AbortSignal.timeout(10_000),
          })
          responseStatus = res.status
          responseBody   = await res.text().catch(() => null)
          status = res.ok ? 'delivered' : 'failed'
        } catch {
          status = 'failed'
        }

        await (supabase as any).from('webhook_events').insert({
          tenant_id:        tenantId,
          endpoint_id:      ep.id,
          event_type:       eventType,
          payload:          { event: eventType, data: payload },
          status,
          attempts:         1,
          response_status:  responseStatus,
          response_body:    responseBody?.slice(0, 500),
          last_attempted_at: new Date().toISOString(),
          delivered_at:     status === 'delivered' ? new Date().toISOString() : null,
        })
      })
  )
}
