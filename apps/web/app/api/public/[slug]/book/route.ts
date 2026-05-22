import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBookingConfirmation } from '@/lib/sms'
import { sendEmail, bookingConfirmationHtml } from '@/lib/email'
import { initBookingPayment } from '@/lib/booking-payment'
import { calculateRoomHarmonyScore } from '@/lib/matching'

const schema = z.object({
  category_id: z.string().uuid(),
  check_in_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  first_name:  z.string().min(1).max(100),
  last_name:   z.string().min(1).max(100),
  phone:       z.string().min(9).max(20),
  email:       z.string().email().optional().nullable(),
  institution: z.string().max(200).optional().nullable(),
  student_id:  z.string().max(50).optional().nullable(),
  notes:       z.string().max(500).optional().nullable(),
  matching_profile: z.object({
    cleanliness: z.number().int().min(1).max(5).nullable().optional(),
    sleep_schedule: z.enum(['early_bird', 'night_owl', 'flexible']).nullable().optional(),
    study_preference: z.enum(['in_room_quiet', 'in_room_background_noise', 'library']).nullable().optional(),
    guest_frequency: z.enum(['none', 'rare', 'frequent']).nullable().optional(),
    noise_tolerance: z.number().int().min(1).max(5).nullable().optional(),
    ac_preference: z.enum(['ac_cold', 'fan_only', 'no_preference']).nullable().optional(),
    hobbies: z.array(z.string()).default([]),
    religion: z.enum(['christian', 'muslim', 'traditional', 'other', 'none', 'prefer_not_to_say']).nullable().optional(),
    religiosity_level: z.enum(['devout', 'moderate', 'not_religious']).nullable().optional(),
    relationship_status: z.enum(['single', 'in_relationship', 'married']).nullable().optional(),
  }).nullable().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = createAdminClient()

  // Resolve tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, is_active, paystack_subaccount_code, roommate_matching_enabled')
    .eq('slug', slug)
    .single()

  if (!tenant || !tenant.is_active) {
    return NextResponse.json({ error: 'Hostel not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const d = parsed.data

  // Verify category belongs to this tenant
  const { data: category } = await supabase
    .from('room_categories')
    .select('id, name, base_rate, rate_unit, capacity')
    .eq('id', d.category_id)
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .single()

  if (!category) {
    return NextResponse.json({ error: 'Room type not found' }, { status: 404 })
  }

  // Free abandoned Paystack holds (pending_payment + unpaid + source=website
  // older than 30 minutes) before checking availability — otherwise a stale
  // unpaid booking could block a fresh guest from grabbing the last bed.
  await supabase.rpc('release_stale_pending_payment_bookings', {
    p_tenant_id: tenant.id,
    p_max_age_minutes: 30,
  })

  // Bed-level availability via room_occupancy_v. A room qualifies when it has
  // at least one free bed and isn't manually held for maintenance/blocked.
  // Prefer partially-filled rooms (fewer free_beds first) so we fill rooms
  // before opening empty ones — keeps occupancy compact.
  const { data: roomCandidates } = await supabase
    .from('room_occupancy_v')
    .select('room_id, free_beds, manual_status')
    .eq('tenant_id', tenant.id)
    .eq('category_id', category.id)
    .gt('free_beds', 0)
    .not('manual_status', 'in', '("maintenance","blocked")')
    .order('free_beds', { ascending: true })

  if (!roomCandidates || roomCandidates.length === 0) {
    return NextResponse.json({ error: 'No rooms available in this category' }, { status: 409 })
  }

  let assignedRoomId = roomCandidates[0].room_id as string

  // If roommate matching is enabled and room category capacity is shared (>1)
  if (tenant.roommate_matching_enabled && category.capacity > 1) {
    try {
      const roomIds = roomCandidates.map(rc => rc.room_id as string)
      // Fetch active bookings in these candidate rooms during the requested dates
      const { data: activeBookings } = await supabase
        .from('bookings')
        .select('room_id, occupant_id')
        .in('room_id', roomIds)
        .lte('check_in_date', d.check_out_date)
        .gte('check_out_date', d.check_in_date)
        .in('status', ['pending_payment', 'confirmed', 'checked_in'])

      if (activeBookings && activeBookings.length > 0) {
        const occupantIds = Array.from(new Set(activeBookings.map(b => b.occupant_id)))
        const { data: profiles } = await supabase
          .from('occupant_matching_profiles')
          .select('*')
          .in('occupant_id', occupantIds)

        const profileMap = new Map(profiles?.map(p => [p.occupant_id, p]) ?? [])

        // Score each candidate room
        const scoredRooms = roomCandidates.map(rc => {
          // Get occupants in this room
          const occupantIdsInRoom = activeBookings
            .filter(b => b.room_id === rc.room_id)
            .map(b => b.occupant_id)

          const roomProfiles = occupantIdsInRoom
            .map(oid => profileMap.get(oid))
            .filter((p): p is NonNullable<typeof p> => !!p)

          const targetProfile = d.matching_profile ?? null
          const score = calculateRoomHarmonyScore(targetProfile, roomProfiles)

          return {
            room_id: rc.room_id as string,
            free_beds: rc.free_beds as number,
            score,
          }
        })

        // Sort: highest compatibility first, then fewest free beds (compactness)
        scoredRooms.sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score
          }
          return a.free_beds - b.free_beds
        })

        assignedRoomId = scoredRooms[0].room_id
      }
    } catch (err) {
      console.error('[Roommate Matching] Error during automated room assignment:', err)
      // Fallback to the first available room candidate (default behavior)
    }
  }

  // Create or find occupant
  let occupantId: string

  const { data: existingOccupant } = await supabase
    .from('occupants')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('phone', d.phone)
    .maybeSingle()

  if (existingOccupant) {
    occupantId = existingOccupant.id
  } else {
    const { data: newOccupant, error: occupantError } = await supabase
      .from('occupants')
      .insert({
        tenant_id:   tenant.id,
        first_name:  d.first_name,
        last_name:   d.last_name,
        phone:       d.phone,
        email:       d.email,
        institution: d.institution,
        student_id:  d.student_id,
        status:      'pending',
        type:        d.institution ? 'student' : 'guest',
      })
      .select('id')
      .single()

    if (occupantError || !newOccupant) {
      return NextResponse.json({ error: 'Failed to create occupant record' }, { status: 500 })
    }
    occupantId = newOccupant.id
  }

  // Generate booking reference: e.g. ABR-2026-047382
  const prefix    = slug.replace(/-/g, '').slice(0, 3).toUpperCase()
  const year      = new Date().getFullYear()
  const suffix    = Math.floor(100000 + Math.random() * 900000)
  const bookingRef = `${prefix}-${year}-${suffix}`

  // Create booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      tenant_id:      tenant.id,
      occupant_id:    occupantId,
      room_id:        assignedRoomId,
      booking_ref:    bookingRef,
      check_in_date:  d.check_in_date,
      check_out_date: d.check_out_date,
      rate_per_unit:  category.base_rate,
      rate_unit:      category.rate_unit,
      total_amount:   category.base_rate,
      paid_amount:    0,
      payment_status: 'unpaid',
      status:         'pending_payment',
      source:         'website',
      notes:          d.notes,
    })
    .select('id, booking_ref')
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: bookingError?.message ?? 'Booking failed' }, { status: 500 })
  }

  // Save occupant matching profile if roommate matching is enabled and provided
  if (tenant.roommate_matching_enabled && category.capacity > 1 && d.matching_profile) {
    try {
      await supabase
        .from('occupant_matching_profiles')
        .upsert({
          tenant_id: tenant.id,
          occupant_id: occupantId,
          ...d.matching_profile,
        }, { onConflict: 'tenant_id,occupant_id' })
    } catch (err) {
      console.error('[Roommate Matching] Error upserting matching profile:', err)
    }
  }

  // Note: with multi-occupancy (migration 070), bed holds come from the
  // bookings row itself via room_occupancy_v, not from rooms.status. The old
  // `rooms.update status='reserved'` flip is intentionally removed — it would
  // mark the whole room held even when other beds remain bookable.

  // Initialize Paystack hosted payment (card / momo / bank / bank_transfer)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host') ?? 'localhost:3000'}`
  const callbackUrl = `${appUrl}/api/public/${slug}/pay/callback?booking_id=${booking.id}&amount=${category.base_rate}`

  let payment: { authorization_url: string; reference: string; amount: number } | null = null
  try {
    const result = await initBookingPayment({
      tenantId:         tenant.id,
      tenantSubaccount: tenant.paystack_subaccount_code ?? null,
      bookingId:        booking.id,
      bookingRef:       booking.booking_ref,
      amountPesewas:    category.base_rate,
      email:            d.email ?? null,
      callbackUrl,
      source:           'public_booking',
    })
    if (result) {
      payment = {
        authorization_url: result.authorizationUrl,
        reference:         result.reference,
        amount:            result.amount,
      }
    }
  } catch (err) {
    console.error('[POST /api/public/[slug]/book] payment init failed', err)
    // Soft-fail: booking still created, guest can pay later via /api/public/[slug]/pay
  }

  // Fetch tenant branding for email
  const { data: tenantFull } = await supabase
    .from('tenants')
    .select('primary_color, logo_url, contact_phone')
    .eq('id', tenant.id)
    .single()

  const primaryColor = tenantFull?.primary_color ?? '#2563EB'
  const logoUrl      = (tenantFull as any)?.logo_url ?? null

  // SMS confirmation (non-blocking)
  sendBookingConfirmation({
    phone:       d.phone,
    firstName:   d.first_name,
    bookingRef:  booking.booking_ref,
    roomNumber:  assignedRoomId,
    checkInDate: d.check_in_date,
    hostelName:  tenant.name,
    tenantId:    tenant.id,
  }).catch(() => {})

  // Email confirmation (non-blocking, only if email provided)
  if (d.email) {
    const formatDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-GH', { dateStyle: 'long' })
    const formatGHS  = (p: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(p / 100)
    sendEmail({
      to:         d.email,
      senderName: tenant.name,
      subject:    `Booking received — ${tenant.name}`,
      html:    bookingConfirmationHtml({
        hostelName:   tenant.name,
        primaryColor,
        logoUrl,
        guestName:    `${d.first_name} ${d.last_name}`,
        bookingRef:   booking.booking_ref,
        roomName:     category.name,
        checkInDate:  formatDate(d.check_in_date),
        checkOutDate: formatDate(d.check_out_date),
        amountGHS:    formatGHS(category.base_rate),
        contactPhone: tenantFull?.contact_phone ?? undefined,
      }),
    }).catch(() => {})
  }

  return NextResponse.json({
    booking_ref:   booking.booking_ref,
    booking_id:    booking.id,
    room_type:     category.name,
    check_in_date: d.check_in_date,
    check_out_date: d.check_out_date,
    amount:        category.base_rate,
    rate_unit:     category.rate_unit,
    status:        'pending_payment',
    payment,
  }, { status: 201 })
}
