/**
 * Bank-draft helpers.
 *
 * - File validation constants and helpers
 * - Storage path builder
 * - Signed-URL builder for download/preview
 * - Three notification dispatchers used by the API routes
 *
 * All money values in this module are pesewas unless explicitly named with
 * a GHS suffix. Conversion happens only at the SMS / display boundary.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToTenant } from '@/lib/push'
import {
  sendBankDraftSubmittedToAdmin,
  sendBankDraftApproved,
  sendBankDraftRejected,
} from '@/lib/sms'

export const BANK_DRAFTS_BUCKET = 'bank-drafts'
export const MAX_DRAFT_BYTES    = 5 * 1024 * 1024
export const ALLOWED_DRAFT_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heic-sequence',
] as const

export const EXT_BY_MIME: Record<string, string> = {
  'application/pdf':     'pdf',
  'image/jpeg':          'jpg',
  'image/png':           'png',
  'image/heic':          'heic',
  'image/heic-sequence': 'heic',
}

export type DraftMime = typeof ALLOWED_DRAFT_MIME[number]

export function buildDraftPath(tenantId: string, bookingId: string, paymentId: string, ext: string) {
  return `${tenantId}/${bookingId}/${paymentId}.${ext}`
}

export async function getSignedDraftUrl(path: string, expiresInSeconds = 600): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(BANK_DRAFTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds)
  if (error || !data) return null
  return data.signedUrl
}

/* ── Notification dispatch ───────────────────────────────────────── */

interface DispatchSubmittedArgs {
  tenantId:    string
  studentName: string
  amount:      number   // pesewas
  bookingRef:  string
  paymentId:   string
}

export async function dispatchDraftSubmitted(args: DispatchSubmittedArgs): Promise<void> {
  const admin = createAdminClient()
  const { data: tenant } = await admin
    .from('tenants')
    .select('name, contact_phone')
    .eq('id', args.tenantId)
    .single()

  const hostelName = tenant?.name ?? 'Hostel'
  const amountGHS  = (args.amount / 100).toFixed(2)
  const reviewUrl  = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/payments/drafts`

  // Web push to all subscribed admin sessions for this tenant
  await sendPushToTenant(args.tenantId, {
    title: 'New bank draft to verify',
    body:  `${args.studentName} uploaded GHS ${amountGHS} for ${args.bookingRef}`,
    url:   `/payments/drafts?focus=${args.paymentId}`,
    tag:   `draft-${args.paymentId}`,
  })

  // SMS to active owner/accountant staff with a phone on file
  const { data: staff } = await admin
    .from('staff_profiles')
    .select('phone, tenant_members!inner(role, is_active, tenant_id)')
    .eq('is_active', true)
    .not('phone', 'is', null)
    .eq('tenant_members.tenant_id', args.tenantId)
    .eq('tenant_members.is_active', true)
    .in('tenant_members.role', ['owner', 'accountant'])

  const phones = new Set<string>()
  for (const row of (staff ?? []) as Array<{ phone: string | null }>) {
    if (row.phone) phones.add(row.phone)
  }
  if (phones.size === 0 && tenant?.contact_phone) {
    phones.add(tenant.contact_phone)
  }

  for (const phone of phones) {
    await sendBankDraftSubmittedToAdmin({
      phone,
      studentName: args.studentName,
      amountGHS,
      bookingRef:  args.bookingRef,
      hostelName,
      reviewUrl,
      tenantId:    args.tenantId,
    })
  }
}

interface DispatchDecisionArgs {
  tenantId:   string
  occupantId: string
  amount:     number   // pesewas
  bookingId:  string
  bookingRef: string
}

export async function dispatchDraftApproved(args: DispatchDecisionArgs): Promise<void> {
  const admin = createAdminClient()
  const [{ data: occupant }, { data: booking }, { data: tenant }] = await Promise.all([
    admin.from('occupants').select('first_name, phone').eq('id', args.occupantId).single(),
    admin.from('bookings').select('final_amount, paid_amount').eq('id', args.bookingId).single(),
    admin.from('tenants').select('name').eq('id', args.tenantId).single(),
  ])

  if (!occupant?.phone) return

  const balance = Math.max(0, (booking?.final_amount ?? 0) - (booking?.paid_amount ?? 0))

  await sendBankDraftApproved({
    phone:       occupant.phone,
    firstName:   occupant.first_name ?? 'there',
    amountGHS:   (args.amount / 100).toFixed(2),
    bookingRef:  args.bookingRef,
    balanceGHS:  (balance / 100).toFixed(2),
    hostelName:  tenant?.name ?? 'Hostel',
    tenantId:    args.tenantId,
  })
}

export async function dispatchDraftRejected(
  args: DispatchDecisionArgs & { reason: string },
): Promise<void> {
  const admin = createAdminClient()
  const [{ data: occupant }, { data: tenant }] = await Promise.all([
    admin.from('occupants').select('first_name, phone').eq('id', args.occupantId).single(),
    admin.from('tenants').select('name').eq('id', args.tenantId).single(),
  ])

  if (!occupant?.phone) return

  await sendBankDraftRejected({
    phone:       occupant.phone,
    firstName:   occupant.first_name ?? 'there',
    amountGHS:   (args.amount / 100).toFixed(2),
    bookingRef:  args.bookingRef,
    reason:      args.reason,
    hostelName:  tenant?.name ?? 'Hostel',
    tenantId:    args.tenantId,
  })
}
