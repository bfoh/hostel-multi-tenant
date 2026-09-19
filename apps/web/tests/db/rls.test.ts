/**
 * Integration tests for Row Level Security, run against a real Postgres
 * cluster with a curated subset of supabase/migrations/ replayed onto it
 * (see tests/db/harness.ts for the exact list and why it's not "all of
 * them" — the migration history has gaps that make a full replay
 * impossible today, independent of anything tested here).
 *
 * These specifically cover the storage-policy bugs found and fixed in
 * migrations 113/114/115, plus a baseline core-table tenant-isolation check
 * so a regression in the fundamental tenant_id() / tenant_role() RLS
 * pattern (migration 002) would be caught here too.
 */
import { randomUUID } from 'node:crypto'

import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startTestDb, type TestDb } from './harness'

let db: TestDb
let client: Client

async function createTenant(name: string): Promise<string> {
  const id = randomUUID()
  await client.query(
    `insert into tenants (id, name, slug, status) values ($1, $2, $3, 'active')`,
    [id, name, name.toLowerCase().replace(/\s+/g, '-') + '-' + id.slice(0, 8)],
  )
  return id
}

async function createMember(tenantId: string, role: string): Promise<string> {
  const userId = randomUUID()
  await client.query(`insert into auth.users (id) values ($1)`, [userId])
  await client.query(
    `insert into tenant_members (id, tenant_id, user_id, role, is_active) values ($1, $2, $3, $4, true)`,
    [randomUUID(), tenantId, userId, role],
  )
  return userId
}

async function insertBucketRow(bucketId: string, name: string, owner: string): Promise<void> {
  await client.query(
    `insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3)`,
    [bucketId, name, owner],
  )
}

beforeAll(async () => {
  db = await startTestDb()
  client = db.client
}, 60_000)

afterAll(async () => {
  await db.teardown()
})

describe('tenant-logos storage policy (migration 113 fix for finding #1)', () => {
  it('blocks a member of tenant B from uploading into tenant A\'s logo path', async () => {
    const tenantA = await createTenant('Tenant A')
    const tenantB = await createTenant('Tenant B')
    const userB = await createMember(tenantB, 'owner')

    await expect(
      db.asUser({ sub: userB, role: 'authenticated' }, async (c) => {
        await c.query(
          `insert into storage.objects (bucket_id, name, owner) values ('tenant-logos', $1, $2)`,
          [`${tenantA}/logo.png`, userB],
        )
      }),
    ).rejects.toThrow(/row-level security/i)
  })

  it('blocks a member of tenant B from deleting tenant A\'s logo', async () => {
    const tenantA = await createTenant('Tenant A')
    const tenantB = await createTenant('Tenant B')
    const ownerA = await createMember(tenantA, 'owner')
    const userB = await createMember(tenantB, 'owner')
    await insertBucketRow('tenant-logos', `${tenantA}/logo.png`, ownerA)

    await db.asUser({ sub: userB, role: 'authenticated' }, async (c) => {
      const res = await c.query(
        `delete from storage.objects where bucket_id = 'tenant-logos' and name = $1`,
        [`${tenantA}/logo.png`],
      )
      // RLS silently filters rows the policy denies rather than throwing on
      // DELETE, so the real assertion is that nothing was removed.
      expect(res.rowCount).toBe(0)
    })

    const stillThere = await client.query(
      `select 1 from storage.objects where bucket_id = 'tenant-logos' and name = $1`,
      [`${tenantA}/logo.png`],
    )
    expect(stillThere.rowCount).toBe(1)
  })

  it('allows a member of tenant A to upload into tenant A\'s own logo path', async () => {
    const tenantA = await createTenant('Tenant A')
    const ownerA = await createMember(tenantA, 'owner')

    await db.asUser(
      { sub: ownerA, role: 'authenticated', tenant_id: tenantA, tenant_role: 'owner' },
      async (c) => {
        await c.query(
          `insert into storage.objects (bucket_id, name, owner) values ('tenant-logos', $1, $2)`,
          [`${tenantA}/logo.png`, ownerA],
        )
      },
      { commit: true },
    )

    const row = await client.query(
      `select 1 from storage.objects where bucket_id = 'tenant-logos' and name = $1`,
      [`${tenantA}/logo.png`],
    )
    expect(row.rowCount).toBe(1)
  })
})

describe('messages attachment storage policy (migration 114 fix for finding #3)', () => {
  async function createConversationWith(userId: string): Promise<string> {
    const conversationId = randomUUID()
    const tenantId = await createTenant('Conv Tenant')
    await client.query(`insert into conversations (id, tenant_id, type) values ($1, $2, 'direct')`, [
      conversationId,
      tenantId,
    ])
    await client.query(
      `insert into conversation_participants (id, conversation_id, user_id, tenant_id) values ($1, $2, $3, $4)`,
      [randomUUID(), conversationId, userId, tenantId],
    )
    return conversationId
  }

  it('blocks uploading into a conversation the caller does not participate in', async () => {
    const memberUserId = randomUUID()
    await client.query(`insert into auth.users (id) values ($1)`, [memberUserId])
    const conversationId = await createConversationWith(memberUserId)

    const outsiderId = randomUUID()
    await client.query(`insert into auth.users (id) values ($1)`, [outsiderId])

    await expect(
      db.asUser({ sub: outsiderId, role: 'authenticated' }, async (c) => {
        await c.query(
          `insert into storage.objects (bucket_id, name, owner) values ('messages', $1, $2)`,
          [`conversations/${conversationId}/${outsiderId}/evidence.png`, outsiderId],
        )
      }),
    ).rejects.toThrow(/row-level security/i)
  })

  it('blocks a participant from uploading under a different sender_id (spoofing another participant)', async () => {
    const userA = randomUUID()
    const userB = randomUUID()
    await client.query(`insert into auth.users (id) values ($1), ($2)`, [userA, userB])
    const conversationId = randomUUID()
    const tenantId = await createTenant('Spoof Tenant')
    await client.query(`insert into conversations (id, tenant_id, type) values ($1, $2, 'group')`, [conversationId, tenantId])
    await client.query(
      `insert into conversation_participants (id, conversation_id, user_id, tenant_id)
       values ($1, $2, $3, $4), ($5, $2, $6, $4)`,
      [randomUUID(), conversationId, userA, tenantId, randomUUID(), userB],
    )

    await expect(
      db.asUser({ sub: userA, role: 'authenticated' }, async (c) => {
        // userA is a real participant, but is uploading under userB's sender segment.
        await c.query(
          `insert into storage.objects (bucket_id, name, owner) values ('messages', $1, $2)`,
          [`conversations/${conversationId}/${userB}/spoofed.png`, userA],
        )
      }),
    ).rejects.toThrow(/row-level security/i)
  })

  it('allows a participant to upload under their own sender_id', async () => {
    const userId = randomUUID()
    await client.query(`insert into auth.users (id) values ($1)`, [userId])
    const conversationId = await createConversationWith(userId)

    await db.asUser(
      { sub: userId, role: 'authenticated' },
      async (c) => {
        await c.query(
          `insert into storage.objects (bucket_id, name, owner) values ('messages', $1, $2)`,
          [`conversations/${conversationId}/${userId}/photo.png`, userId],
        )
      },
      { commit: true },
    )

    const row = await client.query(
      `select 1 from storage.objects where bucket_id = 'messages' and name = $1`,
      [`conversations/${conversationId}/${userId}/photo.png`],
    )
    expect(row.rowCount).toBe(1)
  })
})

describe('baseline: core-table tenant isolation (migration 002 pattern)', () => {
  it('does not let a tenant B staff member read tenant A\'s rooms', async () => {
    const tenantA = await createTenant('Rooms Tenant A')
    const tenantB = await createTenant('Rooms Tenant B')
    await createMember(tenantA, 'owner')
    const userB = await createMember(tenantB, 'owner')

    await client.query(
      `insert into room_categories (id, tenant_id, name, type, base_rate) values ($1, $2, 'Single', 'single', 100000)`,
      [randomUUID(), tenantA],
    )
    const categoryId = (
      await client.query(`select id from room_categories where tenant_id = $1`, [tenantA])
    ).rows[0].id
    await client.query(
      `insert into rooms (id, tenant_id, category_id, room_number, status) values ($1, $2, $3, '101', 'available')`,
      [randomUUID(), tenantA, categoryId],
    )

    await db.asUser({ sub: userB, role: 'authenticated', tenant_id: tenantB, tenant_role: 'owner' }, async (c) => {
      const res = await c.query(`select * from rooms where tenant_id = $1`, [tenantA])
      expect(res.rowCount).toBe(0)
    })
  })
})
