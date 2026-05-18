import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { initializeTransaction } from '@/lib/paystack'
import {
  selfCheckinSchema,
  GHANA_CARD_MAX_BYTES,
  ALLOWED_IMAGE_MIME,
} from '@/lib/validation/self-checkin'

/**
 * POST /api/public/{slug}/self-checkin
 *
 * Multipart form. Fields:
 *  - payload: JSON string matching selfCheckinSchema
 *  - ghana_card_front: image (required)
 *  - ghana_card_back:  image (required)
 *
 * Flow:
 *  1. Resolve tenant by slug
 *  2. Validate JSON payload + 2 image files
 *  3. Upsert occupant by phone (reuse if exists, skip if blacklisted)
 *  4. Upload both images to occupant-documents bucket
 *  5. Insert occupant_documents rows
 *  6. Pick available room in chosen category
 *  7. Create booking (status='pending_confirmation', payment_status='unpaid')
 *  8. Initialize Paystack hosted transaction → return authorization_url
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, slug, is_active, paystack_subaccount_code')
    .eq('slug', slug)
    .single()

  if (!tenant || !tenant.is_active) {
    return NextResponse.json({ error: 'Hostel not found' }, { status: 404 })
  }

  // Release rooms held by abandoned submissions before we check availability.
  await admin.rpc('release_stale_self_checkin_reservations', {
    p_tenant_id: tenant.id,
    p_max_age_minutes: 30,
  })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const payloadRaw = formData.get('payload')
  if (typeof payloadRaw !== 'string') {
    return NextResponse.json({ error: 'payload field missing' }, { status: 400 })
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(payloadRaw)
  } catch {
    return NextResponse.json({ error: 'payload is not valid JSON' }, { status: 400 })
  }

  const parsed = selfCheckinSchema.safeParse(parsedJson)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const front = formData.get('ghana_card_front')
  const back  = formData.get('ghana_card_back')
  if (!(front instanceof File) || !(back instanceof File)) {
    return NextResponse.json({ error: 'Both Ghana Card images are required' }, { status: 400 })
  }

  for (const f of [front, back]) {
    if (!ALLOWED_IMAGE_MIME.includes(f.type as typeof ALLOWED_IMAGE_MIME[number])) {
      return NextResponse.json({ error: 'Ghana Card images must be JPEG, PNG, or WebP' }, { status: 400 })
    }
    if (f.size > GHANA_CARD_MAX_BYTES) {
      return NextResponse.json({ error: 'Ghana Card image too large (max 5MB)' }, { status: 400 })
    }
  }

  const d = parsed.data

  if (d.check_out_date <= d.check_in_date) {
    return NextResponse.json({ error: 'Check-out date must be after check-in' }, { status: 422 })
  }

  // ── Occupant: reuse by phone, or create new ────────────────────
  const { data: existing } = await admin
    .from('occupants')
    .select('id, status, first_name, last_name, email')
    .eq('tenant_id', tenant.id)
    .eq('phone', d.phone)
    .maybeSingle()

  if (existing && existing.status === 'blacklisted') {
    return NextResponse.json({ error: 'Please speak to staff to complete check-in.' }, { status: 403 })
  }

  let occupantId: string

  if (existing) {
    occupantId = existing.id
    // Patch missing fields, never clobber existing ones
    const patch: Record<string, unknown> = {}
    if (d.email) patch.email = existing.email ?? d.email
    if (d.institution) patch.institution = d.institution
    if (d.student_id) patch.student_id = d.student_id
    if (d.programme) patch.programme = d.programme
    if (d.gender) patch.gender = d.gender
    if (d.emergency_contact_name || d.emergency_contact_phone) {
      patch.emergency_contact = {
        name:  d.emergency_contact_name ?? '',
        phone: d.emergency_contact_phone ?? '',
      }
    }
    if (Object.keys(patch).length) {
      await (admin.from('occupants') as any).update(patch).eq('id', occupantId)
    }
  } else {
    const { data: created, error: occErr } = await admin
      .from('occupants')
      .insert({
        tenant_id:   tenant.id,
        first_name:  d.first_name,
        last_name:   d.last_name,
        phone:       d.phone,
        email:       d.email ?? null,
        gender:      d.gender ?? null,
        institution: d.institution ?? null,
        student_id:  d.student_id ?? null,
        programme:   d.programme ?? null,
        type:        d.institution || d.student_id ? 'student' : 'guest',
        status:      'pending',
        national_id_type: 'ghana_card',
        emergency_contact: d.emergency_contact_name || d.emergency_contact_phone
          ? { name: d.emergency_contact_name ?? '', phone: d.emergency_contact_phone ?? '' }
          : null,
      })
      .select('id')
      .single()

    if (occErr || !created) {
      return NextResponse.json({ error: 'Failed to create occupant' }, { status: 500 })
    }
    occupantId = created.id
  }

  // ── Upload Ghana Card images ───────────────────────────────────
  function extFor(file: File): string {
    const fromName = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : null
    if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName
    // Fallback from MIME type
    if (file.type === 'image/png') return 'png'
    if (file.type === 'image/webp') return 'webp'
    return 'jpg'
  }

  async function uploadCard(
    file: File,
    side: 'front' | 'back',
  ): Promise<{ id: string } | { error: string }> {
    const ext  = extFor(file)
    const path = `${tenant!.id}/${occupantId}/ghana-card-${side}-${Date.now()}.${ext}`

    // Storage upload: pass an ArrayBuffer so we don't depend on Node fetch
    // streaming the File body cleanly (some runtimes choke on raw File here).
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: upErr } = await admin.storage
      .from('occupant-documents')
      .upload(path, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })
    if (upErr) {
      console.error('[self-checkin] storage upload failed', { side, path, error: upErr })
      return { error: `Storage upload failed: ${upErr.message}` }
    }

    const { data: signed, error: signErr } = await admin.storage
      .from('occupant-documents')
      .createSignedUrl(path, 60 * 60 * 24 * 365)
    if (signErr) {
      console.error('[self-checkin] signed url failed', { side, path, error: signErr })
    }

    const { data: doc, error: docErr } = await (admin.from('occupant_documents') as any)
      .insert({
        tenant_id:     tenant!.id,
        occupant_id:   occupantId,
        document_type: 'ghana_card',
        file_name:     `ghana-card-${side}.${ext}`,
        file_url:      signed?.signedUrl ?? path,
        file_size:     file.size,
        mime_type:     file.type || 'image/jpeg',
        notes:         `Self check-in upload (${side})`,
      })
      .select('id')
      .single()

    if (docErr || !doc) {
      console.error('[self-checkin] occupant_documents insert failed', { side, error: docErr })
      return { error: `Document record insert failed: ${docErr?.message ?? 'unknown'}` }
    }

    return { id: doc.id as string }
  }

  const [frontResult, backResult] = await Promise.all([
    uploadCard(front, 'front'),
    uploadCard(back, 'back'),
  ])

  if ('error' in frontResult || 'error' in backResult) {
    const detail = 'error' in frontResult ? frontResult.error : (backResult as { error: string }).error
    return NextResponse.json(
      { error: `Failed to upload Ghana Card images. ${detail}` },
      { status: 500 },
    )
  }

  const frontId = frontResult.id
  const backId  = backResult.id

  // ── Category + available room ──────────────────────────────────
  const { data: category } = await admin
    .from('room_categories')
    .select('id, name, base_rate, rate_unit')
    .eq('id', d.category_id)
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .single()

  if (!category) {
    return NextResponse.json({ error: 'Selected room type not available' }, { status: 404 })
  }

  // Pick a room with at least one free bed in this category. Bed availability
  // is derived from active bookings vs category capacity (room_occupancy_v),
  // not from rooms.status — rooms.status is now a manual override only.
  const { data: candidates } = await admin
    .from('room_occupancy_v')
    .select('room_id, free_beds, manual_status')
    .eq('tenant_id', tenant.id)
    .eq('category_id', d.category_id)
    .gt('free_beds', 0)
    .order('beds_taken', { ascending: false })
    .order('room_id',    { ascending: true })
    .limit(1)

  const availableRoom = candidates?.[0]
  if (!availableRoom) {
    return NextResponse.json({ error: 'No rooms available in this category' }, { status: 409 })
  }

  // ── Booking ────────────────────────────────────────────────────
  const prefix     = slug.replace(/-/g, '').slice(0, 3).toUpperCase()
  const year       = new Date().getFullYear()
  const suffix     = Math.floor(100000 + Math.random() * 900000)
  const bookingRef = `${prefix}-${year}-${suffix}`

  const { data: booking, error: bookErr } = await admin
    .from('bookings')
    .insert({
      tenant_id:                 tenant.id,
      occupant_id:               occupantId,
      room_id:                   availableRoom.room_id,
      booking_ref:               bookingRef,
      check_in_date:             d.check_in_date,
      check_out_date:            d.check_out_date,
      rate_per_unit:             category.base_rate,
      rate_unit:                 category.rate_unit,
      total_amount:              category.base_rate,
      paid_amount:               0,
      payment_status:            'unpaid',
      status:                    'pending_confirmation',
      source:                    'walk_in',
      notes:                     d.notes ?? null,
      self_checkin_submitted_at: new Date().toISOString(),
      ghana_card_front_doc_id:   frontId,
      ghana_card_back_doc_id:    backId,
    } as any)
    .select('id, booking_ref')
    .single()

  if (bookErr || !booking) {
    return NextResponse.json({ error: bookErr?.message ?? 'Failed to create booking' }, { status: 500 })
  }

  // No rooms.status mutation: the booking row itself holds the bed. Effective
  // occupancy is derived (room_occupancy_v). Reserving the room would mask
  // remaining free beds in 2/3/4-in-a-room categories.

  // ── Paystack hosted redirect ───────────────────────────────────
  if (!process.env.PAYSTACK_SECRET_KEY) {
    // Online payment not configured — return without payment URL
    return NextResponse.json({
      booking_ref: booking.booking_ref,
      booking_id:  booking.id,
      amount:      category.base_rate,
      authorization_url: null,
      message: 'Payment will be collected at the front desk.',
    }, { status: 201 })
  }

  if (!tenant.paystack_subaccount_code) {
    return NextResponse.json({
      booking_ref: booking.booking_ref,
      booking_id:  booking.id,
      amount:      category.base_rate,
      authorization_url: null,
      message: 'Payment will be collected at the front desk.',
    }, { status: 201 })
  }

  // Create payment record + initialize Paystack transaction
  const { data: payment, error: payErr } = await admin
    .from('booking_payments')
    .insert({
      tenant_id:  tenant.id,
      booking_id: booking.id,
      amount:     category.base_rate,
      method:     'card' as any,
      status:     'pending',
      reference:  null,
    } as any)
    .select('id')
    .single()

  if (payErr || !payment) {
    return NextResponse.json({ error: 'Failed to initialize payment' }, { status: 500 })
  }

  const reference = `abr-${payment.id}`
  const origin = req.headers.get('origin') ?? new URL(req.url).origin
  const callbackUrl = `${origin}/checkin/${slug}/success?ref=${booking.booking_ref}`

  try {
    const result = await initializeTransaction({
      email:         d.email ?? `${d.phone}@selfcheckin.local`,
      amountPesewas: category.base_rate,
      reference,
      callbackUrl,
      subaccount:    tenant.paystack_subaccount_code,
      bearer:        'subaccount',
      metadata: {
        tenant_id:   tenant.id,
        booking_id:  booking.id,
        payment_id:  payment.id,
        booking_ref: booking.booking_ref,
        source:      'self_checkin',
      },
    })

    await admin
      .from('booking_payments')
      .update({ reference: result.reference })
      .eq('id', payment.id)

    return NextResponse.json({
      booking_ref:       booking.booking_ref,
      booking_id:        booking.id,
      amount:            category.base_rate,
      authorization_url: result.authorizationUrl,
    }, { status: 201 })
  } catch (err) {
    await admin.from('booking_payments').delete().eq('id', payment.id)
    // Booking still exists; user can pay at desk
    return NextResponse.json({
      booking_ref:       booking.booking_ref,
      booking_id:        booking.id,
      amount:            category.base_rate,
      authorization_url: null,
      message: err instanceof Error ? err.message : 'Payment could not be started. Pay at the front desk.',
    }, { status: 201 })
  }
}
