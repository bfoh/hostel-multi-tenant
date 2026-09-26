/**
 * Unit tests for resolveOccupant() (lib/bookings/resolve-occupant.ts) —
 * the phone-match-first logic behind the hotel inline-guest booking flow.
 * A minimal fake Supabase client stands in for the real one so this runs
 * with no network/DB access.
 */
import { describe, expect, it } from 'vitest'
import { resolveOccupant } from '@/lib/bookings/resolve-occupant'

function fakeSupabase(existingOccupants: any[]) {
  const inserted: any[] = []
  const updated: any[] = []

  const client: any = {
    from(table: string) {
      if (table !== 'occupants') throw new Error(`unexpected table ${table}`)
      return {
        select() { return this },
        eq(_col: string, _val: string) { return this },
        maybeSingle: async () => ({ data: existingOccupants[0] ?? null }),
        update(patch: any) {
          updated.push(patch)
          return {
            eq: async () => ({ data: null, error: null }),
          }
        },
        insert(row: any) {
          inserted.push(row)
          return {
            select() {
              return {
                single: async () => ({ data: { id: 'new-occupant-id' }, error: null }),
              }
            },
          }
        },
      }
    },
  }

  return { client, inserted, updated }
}

describe('resolveOccupant', () => {
  it('creates a new occupant when no phone match exists', async () => {
    const { client, inserted } = fakeSupabase([])

    const id = await resolveOccupant(client, 'tenant-1', {
      firstName: 'Ama', lastName: 'Owusu', phone: '0244000000', email: 'ama@example.com',
    })

    expect(id).toBe('new-occupant-id')
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({
      tenant_id: 'tenant-1', type: 'guest', first_name: 'Ama', last_name: 'Owusu', phone: '0244000000',
    })
  })

  it('reuses an existing occupant matched by phone, without updating identical fields', async () => {
    const { client, updated } = fakeSupabase([
      { id: 'existing-id', first_name: 'Kwame', last_name: 'Boateng', email: 'kwame@example.com' },
    ])

    const id = await resolveOccupant(client, 'tenant-1', {
      firstName: 'Kwame', lastName: 'Boateng', phone: '0201111111', email: 'kwame@example.com',
    })

    expect(id).toBe('existing-id')
    expect(updated).toHaveLength(0)
  })

  it('updates the name on an existing occupant when it has changed', async () => {
    const { client, updated } = fakeSupabase([
      { id: 'existing-id', first_name: 'Kwame', last_name: 'Boateng', email: null },
    ])

    const id = await resolveOccupant(client, 'tenant-1', {
      firstName: 'Kwame', lastName: 'Mensah', phone: '0201111111',
    })

    expect(id).toBe('existing-id')
    expect(updated).toHaveLength(1)
    expect(updated[0]).toMatchObject({ first_name: 'Kwame', last_name: 'Mensah' })
  })
})
