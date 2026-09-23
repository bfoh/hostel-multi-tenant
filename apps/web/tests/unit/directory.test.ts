/**
 * Unit tests for searchListings() (lib/directory.ts) — specifically that
 * it actually filters by business_type, the core piece of plumbing that
 * lets one query implementation serve both the hostel and hotel
 * marketplaces without one vertical's listings leaking into the other's
 * directory. createAdminClient is mocked so this runs with no network/DB
 * access — only the query-shaping logic is under test (the underlying
 * .eq('business_type', …) filter is exercised for real against a live
 * Postgres in tests/db/business-type.test.ts's constraint coverage).
 */
import { describe, expect, it, vi } from 'vitest'

interface RecordedCall {
  op: string
  args: unknown[]
}

function createFakeQuery(rows: unknown[]) {
  const calls: RecordedCall[] = []
  const chain: any = {}
  for (const op of ['select', 'eq', 'in', 'ilike', 'order']) {
    chain[op] = (...args: unknown[]) => {
      calls.push({ op, args })
      return chain
    }
  }
  chain.limit = (...args: unknown[]) => {
    calls.push({ op: 'limit', args })
    return Promise.resolve({ data: rows, error: null })
  }
  return { chain, calls }
}

const queries: { chain: any; calls: RecordedCall[] }[] = []

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const q = createFakeQuery([])
      queries.push(q)
      return q.chain
    },
  }),
}))

const { searchListings } = await import('@/lib/directory')

describe('searchListings', () => {
  it('filters by the requested business_type', async () => {
    queries.length = 0
    await searchListings({ businessType: 'hotel' })

    const calls = queries[0].calls
    expect(calls).toContainEqual({ op: 'eq', args: ['business_type', 'hotel'] })
  })

  it('uses a different filter value for the other vertical', async () => {
    queries.length = 0
    await searchListings({ businessType: 'hostel' })

    const calls = queries[0].calls
    expect(calls).toContainEqual({ op: 'eq', args: ['business_type', 'hostel'] })
    expect(calls).not.toContainEqual({ op: 'eq', args: ['business_type', 'hotel'] })
  })

  it('still applies the existing visibility filters alongside business_type', async () => {
    queries.length = 0
    await searchListings({ businessType: 'hostel' })

    const calls = queries[0].calls
    expect(calls).toContainEqual({ op: 'eq', args: ['listed_publicly', true] })
    expect(calls).toContainEqual({ op: 'in', args: ['status', ['trial', 'active', 'trial_expired']] })
  })

  it('applies city/region/q filters on top of business_type when provided', async () => {
    queries.length = 0
    await searchListings({ businessType: 'hotel', city: 'Accra', region: 'Greater Accra', q: 'Alisa' })

    const calls = queries[0].calls
    expect(calls).toContainEqual({ op: 'ilike', args: ['address_city', '%Accra%'] })
    expect(calls).toContainEqual({ op: 'eq', args: ['address_region', 'Greater Accra'] })
    expect(calls).toContainEqual({ op: 'ilike', args: ['name', '%Alisa%'] })
  })
})
