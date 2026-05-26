import { NextResponse, type NextRequest, after } from 'next/server'
import { z } from 'zod'
import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import {
  BANK_DRAFTS_BUCKET,
  ALLOWED_DRAFT_MIME,
  MAX_DRAFT_BYTES,
  EXT_BY_MIME,
  buildDraftPath,
  dispatchDraftSubmitted,
  type DraftMime,
} from '@/lib/bank-draft'

const formSchema = z.object({
  booking_id:    z.string().uuid(),
  amount:        z.coerce.number().int().positive(),         // pesewas
  draft_number:  z.string().min(1).max(40),
  bank_name:     z.string().min(2).max(120),
  deposit_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note:          z.string().max(140).optional().nullable(),
})

export async function POST(req: NextRequest) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let form: FormData
  try { form = await req.formData() }
  catch { return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 }) }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required' }, { status: 422 })
  }
  if (file.size === 0)             return NextResponse.json({ error: 'File is empty' },            { status: 422 })
  if (file.size > MAX_DRAFT_BYTES) return NextResponse.json({ error: 'File is larger than 5 MB' }, { status: 422 })
  if (!ALLOWED_DRAFT_MIME.includes(file.type as DraftMime)) {
    return NextResponse.json({ error: 'File must be PDF, JPG, PNG, or HEIC' }, { status: 422 })
  }

  const fields = {
    booking_id:   form.get('booking_id'),
    amount:       form.get('amount'),
    draft_number: form.get('draft_number'),
    bank_name:    form.get('bank_name'),
    deposit_date: form.get('deposit_date'),
    note:         form.get('note') || null,
  }
  const parsed = formSchema.safeParse(fields)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 422 })
  }

  const admin = createTenantAdminClient(session.tenantId)

  // Tenant must allow bank deposits.
  const { data: tenant } = await admin
    .from('tenants')
    .select('bank_deposits_enabled, name')
    .eq('id', session.tenantId)
    .single()
  if (!(tenant as any)?.bank_deposits_enabled) {
    return NextResponse.json({ error: 'Bank deposits not enabled for this hostel' }, { status: 403 })
  }

  // Booking must belong to this occupant + tenant, and have outstanding balance.
  const { data: booking } = await admin
    .from('bookings')
    .select('id, booking_ref, final_amount, paid_amount, status, occupant_id')
    .eq('id', parsed.data.booking_id)
    .eq('tenant_id', session.tenantId)
    .eq('occupant_id', session.occupantId)
    .single()
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.status === 'cancelled') return NextResponse.json({ error: 'Booking is cancelled' }, { status: 400 })

  const balance = booking.final_amount - booking.paid_amount
  if (balance <= 0) return NextResponse.json({ error: 'No outstanding balance on this booking' }, { status: 400 })

  // Single-pending guarantee — friendly check (DB unique index is the hard guard).
  const { count: pendingCount } = await admin
    .from('booking_payments')
    .select('id', { head: true, count: 'exact' })
    .eq('booking_id', booking.id)
    .eq('method', 'bank_draft' as any)
    .eq('status', 'pending')
  if ((pendingCount ?? 0) > 0) {
    return NextResponse.json(
      { error: 'You already have a draft awaiting verification on this booking.' },
      { status: 409 },
    )
  }

  // 1. Insert payment row first (gets us the id for the storage path).
  const { data: payment, error: insertErr } = await admin
    .from('booking_payments')
    .insert({
      tenant_id:           session.tenantId,
      booking_id:          booking.id,
      amount:              parsed.data.amount,
      method:              'bank_draft',
      status:              'pending',
      reference:           parsed.data.draft_number,
      draft_bank_name:     parsed.data.bank_name,
      draft_number:        parsed.data.draft_number,
      draft_deposit_date:  parsed.data.deposit_date,
      draft_note:          parsed.data.note,
      received_by:         session.userId,
    } as any)
    .select('id')
    .single()

  if (insertErr || !payment) {
    if (insertErr?.message?.includes('booking_payments_one_pending_draft')) {
      return NextResponse.json(
        { error: 'You already have a draft awaiting verification on this booking.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 })
  }

  // 2. Upload file to bucket.
  const ext  = EXT_BY_MIME[file.type] ?? 'bin'
  const path = buildDraftPath(session.tenantId, booking.id, payment.id, ext)
  const buf  = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await admin.storage
    .from(BANK_DRAFTS_BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: false })

  if (uploadErr) {
    // Roll back the row to avoid orphans.
    await admin.from('booking_payments').delete().eq('id', payment.id)
    return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 })
  }

  // 3. Update row with file path. If this fails, roll back BOTH the row
  //    and the just-uploaded file — otherwise we're left with a payment
  //    row that can never be reviewed by admin (no file path) and an
  //    orphan blob in storage.
  const { error: pathUpdateErr } = await admin
    .from('booking_payments')
    .update({ draft_file_path: path } as any)
    .eq('id', payment.id)

  if (pathUpdateErr) {
    await admin.from('booking_payments').delete().eq('id', payment.id)
    await admin.storage.from(BANK_DRAFTS_BUCKET).remove([path])
    return NextResponse.json({ error: 'Failed to record file path. Try again.' }, { status: 500 })
  }

  // 4. Fire-and-forget notifications.
  after(async () => {
    try {
      await dispatchDraftSubmitted({
        tenantId:    session.tenantId,
        studentName: `${session.firstName} ${session.lastName}`.trim(),
        amount:      parsed.data.amount,
        bookingRef:  booking.booking_ref,
        paymentId:   payment.id,
      })
    } catch (e) {
      console.error('[bank-draft] notify dispatch failed', e)
    }
  })

  return NextResponse.json({ payment_id: payment.id, status: 'pending' }, { status: 201 })
}
