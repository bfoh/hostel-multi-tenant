/**
 * Regression test for outgoing tenant webhooks (lib/webhooks.ts). The header
 * names used to contain a space, which made fetch() throw before any request
 * was sent — every delivery was silently logged as failed.
 */
import { createHmac } from 'node:crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

const inserts: any[] = []
vi.mock('@/lib/supabase/tenant-admin', () => ({
  createTenantAdminClient: () => ({
    from(table: string) {
      if (table === 'webhook_endpoints') {
        const q: any = {
          select: () => q,
          eq: async () => ({
            data: [
              { id: 'ep-1', url: 'https://receiver.example/hook', secret: 'whsec', events: ['booking.cancelled'] },
              { id: 'ep-2', url: 'https://other.example/hook', secret: 'x', events: ['payment.received'] },
            ],
          }),
        }
        return q
      }
      return { insert: async (row: unknown) => { inserts.push(row); return { error: null } } }
    },
  }),
}))

// Queued events handed out by claim_webhook_events (migration 147).
let claimed: any[] = []
const updates: Array<{ id: string; row: any }> = []
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (fn: string, args: unknown) => {
      expect(fn).toBe('claim_webhook_events')
      expect(args).toEqual({ p_limit: 50 })
      return { data: claimed, error: null }
    },
    from: (table: string) => {
      expect(table).toBe('webhook_events')
      return {
        update: (row: any) => ({
          eq: (_col: string, id: string) => ({
            eq: async (col: string, tenantId: string) => {
              expect([col, tenantId]).toEqual(['tenant_id', 'tenant-1'])
              updates.push({ id, row })
              return { error: null }
            },
          }),
        }),
      }
    },
  }),
}))

import {
  deliverPendingWebhooks,
  fireWebhook,
  MAX_WEBHOOK_ATTEMPTS,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
} from '@/lib/webhooks'

afterEach(() => { vi.unstubAllGlobals(); inserts.length = 0; claimed = []; updates.length = 0 })

describe('fireWebhook', () => {
  it('uses header names that are valid HTTP tokens', () => {
    expect(() => new Headers({ [WEBHOOK_EVENT_HEADER]: 'e', [WEBHOOK_SIGNATURE_HEADER]: 's' })).not.toThrow()
  })

  it('delivers a signed request to subscribed endpoints only', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      // Real fetch validates headers this way — the old names threw here.
      new Headers(init.headers as Record<string, string>)
      calls.push({ url, init })
      return new Response('ok', { status: 200 })
    }))

    await fireWebhook('tenant-1', 'booking.cancelled', { booking_id: 'b-1' })

    expect(calls).toHaveLength(1)
    const { url, init } = calls[0]
    expect(url).toBe('https://receiver.example/hook')
    const headers = init.headers as Record<string, string>
    expect(headers[WEBHOOK_EVENT_HEADER]).toBe('booking.cancelled')
    const expectedSig = createHmac('sha256', 'whsec').update(init.body as string).digest('hex')
    expect(headers[WEBHOOK_SIGNATURE_HEADER]).toBe(`sha256=${expectedSig}`)
    expect(JSON.parse(init.body as string)).toMatchObject({ event: 'booking.cancelled', tenant_id: 'tenant-1', data: { booking_id: 'b-1' } })
    expect(inserts).toEqual([expect.objectContaining({ endpoint_id: 'ep-1', status: 'delivered', response_status: 200 })])
  })
})

function queued(overrides: Record<string, unknown>) {
  return {
    tenant_id: 'tenant-1',
    endpoint_id: 'ep-1',
    event_type: 'booking.confirmed',
    payload: { event: 'booking.confirmed', data: { booking_id: 'b-1' } },
    attempts: 1,
    created_at: '2026-10-29T10:00:00.000Z',
    url: 'https://receiver.example/hook',
    secret: 'whsec',
    is_active: true,
    ...overrides,
  }
}

describe('deliverPendingWebhooks', () => {
  it('signs and sends queued events with their id and original timestamp', async () => {
    claimed = [queued({ id: 'ev-1' })]
    const calls: Array<{ url: string; init: RequestInit }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      new Headers(init.headers as Record<string, string>)
      calls.push({ url, init })
      return new Response('ok', { status: 200 })
    }))

    await expect(deliverPendingWebhooks()).resolves.toEqual({ claimed: 1, delivered: 1, retrying: 0, failed: 0 })

    const { url, init } = calls[0]
    expect(url).toBe('https://receiver.example/hook')
    expect(JSON.parse(init.body as string)).toEqual({
      id: 'ev-1',
      event: 'booking.confirmed',
      tenant_id: 'tenant-1',
      data: { booking_id: 'b-1' },
      timestamp: '2026-10-29T10:00:00.000Z',
    })
    const headers = init.headers as Record<string, string>
    expect(headers[WEBHOOK_EVENT_HEADER]).toBe('booking.confirmed')
    expect(headers[WEBHOOK_SIGNATURE_HEADER]).toBe(
      `sha256=${createHmac('sha256', 'whsec').update(init.body as string).digest('hex')}`
    )
    expect(updates).toEqual([
      { id: 'ev-1', row: expect.objectContaining({ status: 'delivered', response_status: 200, delivered_at: expect.any(String) }) },
    ])
  })

  it('keeps failed deliveries pending for retry until the last attempt', async () => {
    claimed = [
      queued({ id: 'ev-retry', attempts: 2 }),
      queued({ id: 'ev-last', attempts: MAX_WEBHOOK_ATTEMPTS }),
      queued({ id: 'ev-down', attempts: 1, url: 'https://down.example/hook' }),
    ]
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.startsWith('https://down.')) throw new TypeError('fetch failed')
      return new Response('nope', { status: 500 })
    }))

    await expect(deliverPendingWebhooks()).resolves.toEqual({ claimed: 3, delivered: 0, retrying: 2, failed: 1 })

    const byId = Object.fromEntries(updates.map((u) => [u.id, u.row]))
    expect(byId['ev-retry']).toMatchObject({ status: 'pending', response_status: 500, delivered_at: null })
    expect(byId['ev-last']).toMatchObject({ status: 'failed', response_status: 500 })
    expect(byId['ev-down']).toMatchObject({ status: 'pending', response_status: null })
  })

  it('closes out events for paused endpoints without sending them', async () => {
    claimed = [queued({ id: 'ev-paused', is_active: false })]
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(deliverPendingWebhooks()).resolves.toEqual({ claimed: 1, delivered: 0, retrying: 0, failed: 1 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(updates).toEqual([{ id: 'ev-paused', row: expect.objectContaining({ status: 'failed', response_body: 'Endpoint paused' }) }])
  })
})
