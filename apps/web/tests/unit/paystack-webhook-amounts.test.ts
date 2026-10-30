/**
 * charge.success must not settle anything a charge doesn't pay for. Each
 * branch compares Paystack's charged amount (and GHS currency) with what the
 * record expects — the pending booking payment, the instalment, the food
 * order total, or the amount our server put in the metadata — and an
 * underpaid charge is left on the paystack_events ledger instead of being
 * recorded.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkChargeCoversExpected } from '@/lib/payments/verified-charge'

describe('checkChargeCoversExpected', () => {
  it('accepts a GHS charge that covers the expected amount', () => {
    expect(checkChargeCoversExpected({ currency: 'GHS', amount: 10000 }, 10000)).toEqual({ ok: true, amount: 10000 })
    expect(checkChargeCoversExpected({ currency: 'GHS', amount: 10150, requested_amount: 10000 }, 10000)).toEqual({ ok: true, amount: 10000 })
  })

  it('rejects underpaid, non-GHS and malformed charges', () => {
    expect(checkChargeCoversExpected({ currency: 'GHS', amount: 100 }, 10000)).toMatchObject({ ok: false, reason: 'underpaid', charged: 100 })
    expect(checkChargeCoversExpected({ currency: 'USD', amount: 10000 }, 10000)).toMatchObject({ ok: false, reason: 'currency_mismatch' })
    expect(checkChargeCoversExpected({ currency: 'GHS', amount: '10000' }, 10000)).toMatchObject({ ok: false, reason: 'invalid_amount' })
    expect(checkChargeCoversExpected({ currency: 'GHS', amount: 10000 }, Number.NaN)).toMatchObject({ ok: false, reason: 'invalid_amount' })
  })
})

// ── Route: POST /api/payments/paystack/webhook ─────────────────────────────

vi.mock('@/lib/paystack-webhook', () => ({ verifyWebhookSignature: () => true }))
vi.mock('@/lib/payments/record-online-payment', () => ({ notifyOnlinePayment: vi.fn(async () => {}) }))
vi.mock('@/lib/push', () => ({ sendPushToUsers: vi.fn(async () => {}) }))

type Op = { table: string; op: string; payload?: unknown }
let ops: Op[] = []
let rpcCalls: { name: string; args: unknown }[] = []
let rows: Record<string, Record<string, unknown> | null> = {}

function chain(table: string, op: string, payload?: unknown) {
  ops.push({ table, op, payload })
  const result = { data: rows[table] ?? null, error: null }
  const c: any = {
    select: () => c, eq: () => c, in: () => c,
    maybeSingle: async () => result,
    single: async () => (table === 'paystack_events' ? { data: { id: 'ledger-1' }, error: null } : result),
    then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
  }
  return c
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => chain(table, 'select'),
      insert: (payload: unknown) => chain(table, 'insert', payload),
      update: (payload: unknown) => chain(table, 'update', payload),
      upsert: (payload: unknown) => chain(table, 'upsert', payload),
    }),
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args })
      return { data: { recorded: true, tenant_id: 't-1', booking_id: 'b-1', amount: 50000 }, error: null }
    },
  }),
}))

async function deliver(data: Record<string, unknown>) {
  const { POST } = await import('@/app/api/payments/paystack/webhook/route')
  const body = JSON.stringify({ id: Math.random(), event: 'charge.success', data: { reference: 'ref-1', currency: 'GHS', ...data } })
  const res = await POST(new Request('http://x/api/payments/paystack/webhook', { method: 'POST', body }) as any)
  return { status: res.status, json: await res.json() }
}

const ledgerErrors = () => ops.filter((o) => o.table === 'paystack_events' && o.op === 'update' && (o.payload as any)?.error)

beforeEach(() => {
  ops = []
  rpcCalls = []
  rows = {}
})

describe('Paystack webhook charge.success amount checks', () => {
  it('settles a booking payment the charge covers', async () => {
    rows.booking_payments = { id: 'pay-1', tenant_id: 't-1', amount: 50000 }
    const res = await deliver({ amount: 50000, metadata: { payment_id: 'pay-1' } })
    expect(res.status).toBe(200)
    expect(rpcCalls.map((c) => c.name)).toEqual(['finalize_pending_booking_payment'])
  })

  it('leaves an underpaid booking payment unsettled and on the ledger, without a retry', async () => {
    rows.booking_payments = { id: 'pay-1', tenant_id: 't-1', amount: 50000 }
    const res = await deliver({ amount: 100, metadata: { payment_id: 'pay-1' } })
    expect(res).toEqual({ status: 200, json: { ok: false, rejected: 'underpaid' } })
    expect(rpcCalls).toEqual([])
    expect(String((ledgerErrors()[0]?.payload as any)?.error)).toMatch(/booking_payment.*underpaid.*expected 50000, charged 100/)
  })

  it('does not mark an underpaid food order as paid', async () => {
    rows.food_orders = { total_pesewas: 8000 }
    const res = await deliver({ amount: 500, metadata: { source: 'food_order', order_id: 'o-1', tenant_id: 't-1' } })
    expect(res.json.rejected).toBe('underpaid')
    expect(ops.some((o) => o.table === 'food_orders' && o.op === 'update')).toBe(false)
  })

  it('does not settle an underpaid instalment', async () => {
    rows.payment_plan_installments = { id: 'i-1', status: 'pending', amount: 20000, booking_payment_id: null }
    const res = await deliver({ amount: 2000, metadata: { source: 'installment', tenant_id: 't-1', installment_id: 'i-1', booking_id: 'b-1', amount: 20000 } })
    expect(res.json.rejected).toBe('underpaid')
    expect(rpcCalls).toEqual([])
  })

  it('does not record a walk-in sale, POS sale or damage deposit charged in another currency or for less', async () => {
    await deliver({ amount: 5000, currency: 'USD', metadata: { source: 'walkin_sale', tenant_id: 't-1', revenue_point_id: 'rp-1', amount: 5000 } })
    await deliver({ amount: 10, metadata: { source: 'pos_sale', tenant_id: 't-1', revenue_point_id: 'rp-1', total_amount: 5000 } })
    await deliver({ amount: 10, metadata: { source: 'damage_deposit', tenant_id: 't-1', booking_id: 'b-1', occupant_id: 'o-1', deposit_amount: 30000 } })
    expect(ops.filter((o) => o.op === 'insert' && o.table !== 'paystack_events')).toEqual([])
    expect(ledgerErrors()).toHaveLength(3)
  })

  it('records a walk-in sale whose charge covers the metadata amount', async () => {
    const res = await deliver({ amount: 5000, metadata: { source: 'walkin_sale', tenant_id: 't-1', revenue_point_id: 'rp-1', amount: 5000 } })
    expect(res.json).toEqual({ ok: true })
    expect(ops.some((o) => o.table === 'revenue_point_sales' && o.op === 'insert')).toBe(true)
  })
})
