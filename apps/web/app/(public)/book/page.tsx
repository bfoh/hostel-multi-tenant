import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { Phone, Mail, MapPin } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { BookingFlow } from '@/components/public/booking-flow'
import { amenityIcon, amenityLabel } from '@/lib/amenity-icons'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Dynamic metadata per hostel
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantFromRequest()
  if (!tenant) return { title: 'Book a Room' }

  return {
    title: { absolute: `Book a Room — ${tenant.name}` },
    description:
      tenant.tagline ??
      `Book accommodation at ${tenant.name}. Check availability and reserve your room online.`,
    openGraph: {
      title: `${tenant.name} — Book a Room`,
      description: tenant.tagline ?? `Book accommodation at ${tenant.name}.`,
      images: tenant.logo_url ? [{ url: tenant.logo_url }] : [],
    },
  }
}

interface CmsContent {
  hero_heading?: string | null
  hero_subheading?: string | null
  about_text?: string | null
  amenities?: string[]
  gallery_urls?: string[]
  faqs?: { q: string; a: string }[]
}

interface TenantRow {
  id: string
  slug: string
  name: string
  tagline: string | null
  logo_url: string | null
  hero_image_url: string | null
  primary_color: string | null
  contact_phone: string | null
  contact_email: string | null
  address_line1: string | null
  address_city: string | null
  address_region: string | null
  website_url: string | null
  website_content: CmsContent
  roommate_matching_enabled?: boolean
  online_booking_enabled: boolean
}

async function getTenantFromRequest(): Promise<TenantRow | null> {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('tenants')
    .select(
      'id, slug, name, tagline, logo_url, hero_image_url, primary_color, contact_phone, contact_email, address_line1, address_city, address_region, website_url, website_content, roommate_matching_enabled, online_booking_enabled'
    )
    .eq('id', tenantId)
    .single()

  return data as TenantRow | null
}

interface RawCategory {
  id: string
  name: string
  type: string
  base_rate: number
  rate_unit: string
  capacity: number
  amenities: string[] | null
  description: string | null
  image_urls: string[] | null
}

interface OccupancyRow {
  category_id: string
  capacity: number
  free_beds: number
  manual_status: string
}

async function getRoomCategories(tenantId: string) {
  const supabase = createAdminClient()

  const [{ data: catData }, { data: occData }] = await Promise.all([
    supabase
      .from('room_categories')
      .select('id, name, type, base_rate, rate_unit, capacity, amenities, description, image_urls')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('room_occupancy_v')
      .select('category_id, capacity, free_beds, manual_status')
      .eq('tenant_id', tenantId),
  ])

  const occByCat = new Map<string, { available: number; total: number }>()
  for (const row of (occData ?? []) as unknown as OccupancyRow[]) {
    const agg = occByCat.get(row.category_id) ?? { available: 0, total: 0 }
    agg.total += row.capacity
    if (row.manual_status !== 'maintenance' && row.manual_status !== 'blocked') {
      agg.available += row.free_beds
    }
    occByCat.set(row.category_id, agg)
  }

  return ((catData ?? []) as unknown as RawCategory[]).map((cat) => {
    const occ = occByCat.get(cat.id) ?? { available: 0, total: 0 }
    return {
      id: cat.id,
      name: cat.name,
      type: cat.type,
      base_rate: cat.base_rate,
      rate_unit: cat.rate_unit,
      capacity: cat.capacity,
      amenities: cat.amenities ?? [],
      description: cat.description ?? null,
      image_urls: cat.image_urls ?? [],
      available: occ.available,
      total: occ.total,
    }
  })
}

export default async function PublicBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>
}) {
  const { room } = await searchParams
  const tenant = await getTenantFromRequest()
  if (!tenant) notFound()

  // Owner-paused online booking: rooms stay configured, but nothing shows
  // as bookable until they turn this back on in Settings → Public Listing —
  // reuses the existing "no rooms available" empty state below as-is.
  const categories =
    tenant.online_booking_enabled === false ? [] : await getRoomCategories(tenant.id)
  // The property's own colour; Beddilo's Deep Teal when it hasn't set one.
  const brandColor = tenant.primary_color ?? '#173B42'
  const cms: CmsContent = tenant.website_content ?? {}
  const address = [tenant.address_line1, tenant.address_city, tenant.address_region].filter(Boolean).join(', ')
  const heading = 'font-display text-[22px] font-bold tracking-[-0.01em] text-bd-ink sm:text-[26px]'

  return (
    <div className="min-h-screen bg-white text-bd-ink antialiased">
      {/* ── Header — the property's own name, logo and colour ───────── */}
      <header className="border-t-4 border-b border-b-bd-ink/10 bg-white" style={{ borderTopColor: brandColor }}>
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-6 sm:py-10">
          <div className="flex items-center gap-4">
            {tenant.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logo_url}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl border border-bd-ink/10 bg-white object-contain p-1"
              />
            ) : (
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl font-display text-2xl font-bold text-white"
                style={{ backgroundColor: brandColor }}
                aria-hidden="true"
              >
                {tenant.name[0]}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.015em] sm:text-[32px]">
                {cms.hero_heading ?? tenant.name}
              </h1>
              {(cms.hero_subheading ?? tenant.tagline) && (
                <p className="mt-0.5 text-[15px] text-bd-slate sm:text-[16px]">{cms.hero_subheading ?? tenant.tagline}</p>
              )}
            </div>
          </div>

          {/* Contact strip */}
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-bd-slate">
            {tenant.contact_phone && (
              <a href={`tel:${tenant.contact_phone}`} className="flex items-center gap-1.5 hover:text-bd-ink">
                <Phone className="h-4 w-4" aria-hidden="true" />
                {tenant.contact_phone}
              </a>
            )}
            {tenant.contact_email && (
              <a href={`mailto:${tenant.contact_email}`} className="flex items-center gap-1.5 hover:text-bd-ink">
                <Mail className="h-4 w-4" aria-hidden="true" />
                {tenant.contact_email}
              </a>
            )}
            {address && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {address}
              </span>
            )}
          </div>

          {/* The owner's own cover photo, when they have uploaded one. */}
          {tenant.hero_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.hero_image_url}
              alt={`${tenant.name}`}
              className="mt-7 aspect-[21/9] w-full rounded-xl bg-bd-mist object-cover"
            />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-14 px-5 py-10 sm:px-6 sm:py-12">
        {/* Room booking */}
        <section aria-labelledby="rooms-heading">
          <h2 id="rooms-heading" className={heading}>Choose a room</h2>
          <p className="mb-6 mt-1 text-[15px] text-bd-slate">
            Prices are in Ghana cedis and show how each room is billed. You pay {tenant.name} directly.
          </p>

          {categories.length === 0 ? (
            <div className="rounded-xl bg-bd-mist px-6 py-14 text-center">
              <p className="text-[16px] font-semibold">No rooms are open for online booking right now</p>
              <p className="mt-1 text-[15px] text-bd-slate">Contact the property to ask about availability.</p>
              {tenant.contact_phone && (
                <a
                  href={`tel:${tenant.contact_phone}`}
                  className="mt-5 inline-flex min-h-[44px] items-center rounded-lg px-6 text-[15px] font-semibold text-white"
                  style={{ backgroundColor: brandColor }}
                >
                  Call {tenant.contact_phone}
                </a>
              )}
            </div>
          ) : (
            <BookingFlow
              categories={categories}
              initialCategoryId={room ?? null}
              tenant={{
                id: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
                brandColor,
                roommate_matching_enabled: tenant.roommate_matching_enabled ?? false,
              }}
            />
          )}
        </section>

        {/* About */}
        {cms.about_text && (
          <section aria-labelledby="about-heading">
            <h2 id="about-heading" className={heading}>About {tenant.name}</h2>
            <p className="mt-3 max-w-3xl whitespace-pre-line text-[16px] leading-relaxed text-bd-ink/85">{cms.about_text}</p>
          </section>
        )}

        {/* Amenities */}
        {cms.amenities && cms.amenities.length > 0 && (
          <section aria-labelledby="amenities-heading">
            <h2 id="amenities-heading" className={heading}>Facilities</h2>
            <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {cms.amenities.map((a) => {
                const Icon = amenityIcon(a)
                return (
                  <li key={a} className="flex items-center gap-2.5 text-[15px]">
                    <Icon className="h-[18px] w-[18px] shrink-0 text-bd-slate" aria-hidden="true" />
                    {amenityLabel(a)}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Gallery */}
        {cms.gallery_urls && cms.gallery_urls.length > 0 && (
          <section aria-labelledby="gallery-heading">
            <h2 id="gallery-heading" className={heading}>Photos</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cms.gallery_urls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt={`${tenant.name} photo ${i + 1}`}
                  className="aspect-[4/3] w-full rounded-xl bg-bd-mist object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        {cms.faqs && cms.faqs.length > 0 && (
          <section aria-labelledby="faq-heading">
            <h2 id="faq-heading" className={heading}>Questions</h2>
            <div className="mt-4 divide-y divide-bd-ink/10 border-y border-bd-ink/10">
              {cms.faqs.map((faq, i) => (
                <details key={i} className="group">
                  <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 py-3 text-[16px] font-semibold">
                    {faq.q}
                    <span className="shrink-0 text-bd-slate transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
                  </summary>
                  <p className="pb-4 text-[15px] leading-relaxed text-bd-slate">{faq.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-bd-ink/10 bg-bd-mist py-8">
        <div className="mx-auto max-w-5xl px-5 text-center text-[13px] text-bd-slate sm:px-6">
          <p>
            {tenant.name} · Powered by <span className="font-semibold text-bd-ink">Beddilo</span>
          </p>
          {tenant.contact_phone && (
            <p className="mt-1">
              Questions? Call or WhatsApp{' '}
              <a
                href={`https://wa.me/${tenant.contact_phone.replace(/\D/g, '').replace(/^0/, '233')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-bd-ink underline underline-offset-2"
              >
                {tenant.contact_phone}
              </a>
            </p>
          )}
        </div>
      </footer>
    </div>
  )
}
