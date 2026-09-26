import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import { disableSubscription } from '@/lib/paystack'

// Buckets whose object paths are prefixed by tenant id (see each bucket's
// own storage migration for the exact convention). `messages` is excluded —
// it's keyed by conversation id instead (see purgeTenantStorage).
const TENANT_PREFIXED_BUCKETS = [
  'tenant-logos', 'tenant-photos', 'room-photos',
  'occupant-documents', 'bank-drafts', 'maintenance-attachments', 'menu-photos',
]

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Storage's list() only returns one level of a prefix, and several of these
 * buckets nest tenant-id/.../filename several levels deep — so walk it.
 * Entries with an `id` are real objects; entries without one are
 * pseudo-folders to recurse into. Bounded depth as a sanity guard, not
 * because any known bucket actually nests that deep.
 */
async function listAllFiles(admin: AdminClient, bucket: string, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 4) return []
  const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 })
  const files: string[] = []
  for (const entry of data ?? []) {
    const path = `${prefix}/${entry.name}`
    if (entry.id) files.push(path)
    else files.push(...await listAllFiles(admin, bucket, path, depth + 1))
  }
  return files
}

/**
 * Best-effort — not fatal if it partially fails. By the time this runs the
 * tenant row (and everything cascaded from it) is already gone from
 * Postgres; leftover Storage objects are orphaned bytes, not a correctness
 * problem, so one bucket failing shouldn't stop the others.
 */
async function purgeTenantStorage(admin: AdminClient, tenantId: string, conversationIds: string[]) {
  for (const bucket of TENANT_PREFIXED_BUCKETS) {
    try {
      const files = await listAllFiles(admin, bucket, tenantId)
      if (files.length > 0) await admin.storage.from(bucket).remove(files)
    } catch {
      // best-effort — move on to the next bucket
    }
  }

  for (const conversationId of conversationIds) {
    try {
      const files = await listAllFiles(admin, 'messages', `conversations/${conversationId}`)
      if (files.length > 0) await admin.storage.from('messages').remove(files)
    } catch {
      // best-effort
    }
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { status } = body

  const VALID_STATUSES = ['trial', 'trial_expired', 'active', 'suspended', 'cancelled']
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('tenants')
    .update({ status })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/admin/tenants/[id]
 *
 * Permanently deletes a tenant. Every tenant-scoped table's tenant_id FK is
 * ON DELETE CASCADE (see supabase/migrations — the one exception is
 * paystack_events, deliberately ON DELETE SET NULL to preserve the
 * billing-event audit trail after a tenant is gone), so deleting the
 * tenants row alone removes the entire row-set in one statement. What
 * cascades can't reach — Storage objects and a live Paystack subscription —
 * is handled explicitly below, in an order that matters: the Paystack
 * subscription must be disabled BEFORE the DB row is gone, since
 * tenant_subscriptions (which holds the only local reference needed to stop
 * it) cascades away with the tenant.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => null)

  const admin = createAdminClient()

  const { data: tenant } = await admin.from('tenants').select('id, slug, name').eq('id', id).maybeSingle()
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  // The UI enforces this too, but never trust the client alone for
  // something this irreversible.
  if (body?.confirmSlug !== tenant.slug) {
    return NextResponse.json({ error: 'Confirmation slug does not match' }, { status: 400 })
  }

  // 1. Disable any live Paystack subscription first (see header comment).
  const { data: sub } = await admin
    .from('tenant_subscriptions')
    .select('id, paystack_subscription_code, paystack_email_token, status')
    .eq('tenant_id', id)
    .in('status', ['trialing', 'active', 'past_due'])
    .maybeSingle()

  if (sub?.paystack_subscription_code && sub.paystack_email_token) {
    try {
      await disableSubscription({ code: sub.paystack_subscription_code, token: sub.paystack_email_token })
    } catch (err: any) {
      return NextResponse.json(
        { error: `Could not cancel the live Paystack subscription first (${err.message ?? 'Paystack error'}). Resolve billing before deleting.` },
        { status: 502 },
      )
    }
  }

  // 2. Gather conversation ids before deleting — conversations cascades
  // away with the tenant row in step 3, and the messages Storage bucket is
  // keyed by conversation id, not tenant id, so this is needed for step 4.
  const { data: conversations } = await admin.from('conversations').select('id').eq('tenant_id', id)
  const conversationIds = (conversations ?? []).map((c) => c.id as string)

  // 3. Delete the tenant row — cascades the entire schema (see header comment).
  const { error: deleteError } = await admin.from('tenants').delete().eq('id', id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  // 4. Best-effort Storage cleanup — not fatal if it partially fails.
  await purgeTenantStorage(admin, id, conversationIds)

  // 5. Nothing in this admin panel logs sensitive actions today (not even
  // impersonation) — this is the cheapest possible answer to "who deleted
  // this and when" without a schema change.
  console.log('[admin] tenant deleted', {
    adminUserId: user.id,
    tenantId:    tenant.id,
    tenantSlug:  tenant.slug,
    tenantName:  tenant.name,
    at:          new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}
