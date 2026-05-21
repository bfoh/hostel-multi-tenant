import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { SelfCheckinFlow } from '@/components/public/self-checkin-flow'

export const dynamic = 'force-dynamic'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const admin = createAdminClient()
  const { data } = await admin.from('tenants').select('name').eq('slug', slug).maybeSingle()
  const name = data?.name ?? 'Hostel'
  return {
    title: `Self Check-in — ${name}`,
    description: `Scan to check in at ${name}. Fill your details, capture your Ghana Card, and pay online.`,
  }
}

export default async function SelfCheckinPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: tenant } = await admin
    .from('tenants')
    .select('id, slug, name, tagline, logo_url, primary_color, is_active, contact_phone')
    .eq('slug', slug)
    .maybeSingle()

  if (!tenant || !tenant.is_active) notFound()

  // Free up rooms held by abandoned self-checkin submissions so the
  // category list reflects what's actually bookable right now.
  await admin.rpc('release_stale_self_checkin_reservations', {
    p_tenant_id: tenant.id,
    p_max_age_minutes: 30,
  })

  // Categories with at least one free bed. Bed counts are derived from
  // room_occupancy_v (active bookings vs category capacity), not from
  // rooms.status, so 2/3/4-in-a-room categories report correctly when
  // partially filled.
  const { data: cats } = await admin
    .from('room_categories')
    .select('id, name, description, base_rate, rate_unit')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('base_rate', { ascending: true })

  const { data: occupancy } = await admin
    .from('room_occupancy_v')
    .select('room_id, category_id, room_number, capacity, beds_taken, free_beds, manual_status')
    .eq('tenant_id', tenant.id)

  // Pull block from rooms (the view doesn't expose it)
  const { data: roomRows } = await admin
    .from('rooms')
    .select('id, block, floor')
    .eq('tenant_id', tenant.id)

  const blockById = new Map((roomRows ?? []).map((r: any) => [r.id as string, { block: r.block as string | null, floor: r.floor as number | null }]))

  const freeByCategory = new Map<string, number>()
  const roomsByCategory = new Map<string, Array<{
    room_id: string; room_number: string; block: string | null; floor: number | null;
    capacity: number; beds_taken: number; free_beds: number
  }>>()

  for (const row of (occupancy ?? []) as any[]) {
    const key = row.category_id as string
    freeByCategory.set(key, (freeByCategory.get(key) ?? 0) + (row.free_beds as number))
    if (row.manual_status === 'maintenance' || row.manual_status === 'blocked') continue
    if ((row.free_beds as number) <= 0) continue
    const meta = blockById.get(row.room_id as string)
    const arr = roomsByCategory.get(key) ?? []
    arr.push({
      room_id:     row.room_id,
      room_number: row.room_number,
      block:       meta?.block ?? null,
      floor:       meta?.floor ?? null,
      capacity:    row.capacity,
      beds_taken:  row.beds_taken,
      free_beds:   row.free_beds,
    })
    roomsByCategory.set(key, arr)
  }
  // sort rooms by (block, room_number) for stable dropdown order
  for (const arr of roomsByCategory.values()) {
    arr.sort((a, b) =>
      (a.block ?? '').localeCompare(b.block ?? '') ||
      a.room_number.localeCompare(b.room_number, undefined, { numeric: true })
    )
  }

  const categories = (cats ?? [])
    .map((c) => ({
      id:          c.id,
      name:        c.name,
      description: c.description as string | null,
      base_rate:   c.base_rate as number,
      rate_unit:   c.rate_unit as string,
      available:   freeByCategory.get(c.id) ?? 0,
      rooms:       roomsByCategory.get(c.id) ?? [],
    }))
    .filter((c) => c.available > 0)

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center gap-3">
          {tenant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div
              className="h-12 w-12 rounded-full"
              style={{ background: tenant.primary_color ?? '#7A3B2E' }}
            />
          )}
          <div>
            <h1 className="text-lg font-bold text-text-primary">{tenant.name}</h1>
            <p className="text-xs text-text-secondary">Self check-in</p>
          </div>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-6 text-center">
            <p className="font-medium text-text-primary">No rooms available right now</p>
            <p className="mt-1 text-sm text-text-secondary">
              Please speak to the front desk.
            </p>
            {tenant.contact_phone && (
              <a
                href={`tel:${tenant.contact_phone}`}
                className="mt-3 inline-block text-sm font-medium text-brand"
              >
                Call {tenant.contact_phone}
              </a>
            )}
          </div>
        ) : (
          <SelfCheckinFlow
            tenant={{ slug: tenant.slug, name: tenant.name }}
            categories={categories}
          />
        )}
      </div>
    </div>
  )
}
