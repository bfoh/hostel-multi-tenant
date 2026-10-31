import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Mail, Star, ArrowRight, ExternalLink, Users, BedDouble, Building2, Home, ImageOff } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { amenityIcon, amenityLabel } from '@/lib/amenity-icons'
import { tenantHost, bareRootDomain, type BusinessType } from '@/lib/tenant/host-classification'
import { stayTypeLabel, stayVertical, capacityLabel, bedAvailability, displayName, displayPlace, listingLocation } from '@/lib/listing-display'
import { MarketplaceNav } from '@/components/marketplace/marketplace-nav'
import { MarketplaceFooter } from '@/components/marketplace/marketplace-footer'
import { ShareButton } from '@/components/public/share-button'
import { ListingGallery } from '@/components/public/listing-gallery'
import { Price } from '@/components/public/price'
import { MP } from '@/lib/marketplace-theme'

interface CmsContent {
  hero_heading?:    string | null
  hero_subheading?: string | null
  about_text?:      string | null
  amenities?:       string[]
  gallery_urls?:    string[]
  faqs?:            Array<{ q?: string | null; a?: string | null }>
}

interface OccupancyRow {
  category_id:   string
  free_beds:     number
  capacity:      number
  manual_status: string
}

async function getListing(slug: string) {
  const supabase = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug, name, tagline, logo_url, hero_image_url, primary_color, contact_phone, contact_email, address_line1, address_city, address_region, custom_domain, website_content, listed_publicly, status, business_type, accommodation_type, online_booking_enabled')
    .eq('slug', slug)
    .maybeSingle()

  if (!tenant || !tenant.listed_publicly || !['trial', 'active', 'trial_expired'].includes(tenant.status)) {
    return null
  }

  const [{ data: categories }, { data: occupancy }, { data: testimonials }] = await Promise.all([
    supabase
      .from('room_categories')
      .select('id, name, type, base_rate, rate_unit, capacity, amenities, description, image_urls')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('sort_order'),
    // Same free-bed counts the property's booking page shows.
    supabase
      .from('room_occupancy_v')
      .select('category_id, capacity, free_beds, manual_status')
      .eq('tenant_id', tenant.id),
    supabase
      .from('occupant_feedback')
      .select('overall_rating, comments, submitted_at, occupants(first_name, last_name)')
      .eq('tenant_id', tenant.id)
      .eq('status', 'approved')
      .eq('featured', true)
      .not('comments', 'is', null)
      .order('submitted_at', { ascending: false })
      .limit(6),
  ])

  const beds = new Map<string, { available: number; total: number }>()
  for (const row of (occupancy ?? []) as unknown as OccupancyRow[]) {
    const agg = beds.get(row.category_id) ?? { available: 0, total: 0 }
    agg.total += row.capacity
    if (row.manual_status !== 'maintenance' && row.manual_status !== 'blocked') agg.available += row.free_beds
    beds.set(row.category_id, agg)
  }

  return { tenant, categories: categories ?? [], beds, testimonials: testimonials ?? [] }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const result = await getListing(slug)
  if (!result) return { title: 'Property Not Found' }
  return {
    title: { absolute: `${displayName(result.tenant.name)} — Beddilo` },
    description: result.tenant.tagline ?? `Book a room at ${displayName(result.tenant.name)} in ${displayPlace(result.tenant.address_city) ?? 'Ghana'}.`,
  }
}

const STAY_ICON = { hostel: BedDouble, hotel: Building2, apartment: Home } as const

export default async function ListingProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await getListing(slug)
  if (!result) notFound()

  const { tenant, categories, beds, testimonials } = result
  const cms = (tenant.website_content ?? {}) as CmsContent
  const isHostel = tenant.business_type === 'hostel'
  const vertical = stayVertical(tenant.business_type, tenant.accommodation_type)
  const stayType = stayTypeLabel(tenant.business_type, tenant.accommodation_type)
  const StayIcon = STAY_ICON[vertical]
  const nounPlural = vertical === 'hostel' ? 'Hostels' : vertical === 'apartment' ? 'Apartments' : 'Hotels'
  const browseHref = (extra: Record<string, string> = {}) => {
    const qs = new URLSearchParams({ ...extra, ...(vertical === 'hostel' ? {} : { type: vertical }) }).toString()
    return qs ? `/browse?${qs}` : '/browse'
  }

  const rootDomain = bareRootDomain(process.env.NEXT_PUBLIC_APP_DOMAIN)
  const bookUrl = tenant.custom_domain
    ? `https://${tenant.custom_domain}/book`
    : `https://${tenantHost(tenant.slug, tenant.business_type as BusinessType, rootDomain)}/book`
  // Owners can pause online booking (Settings → Public Listing); the
  // booking page then shows nothing bookable, so don't send guests there.
  const bookingOpen = tenant.online_booking_enabled !== false && categories.length > 0

  // Shown in normal case (see displayName); links and lookups keep the stored values.
  const name = displayName(tenant.name)
  const city = displayPlace(tenant.address_city)
  const location = listingLocation(tenant.address_city, tenant.address_region)
  const fullAddress = [tenant.address_line1?.trim(), location].filter(Boolean).join(', ')

  // Gallery: the owner's property photo leads when set, followed by the CMS
  // gallery (or every room photo across categories as a fallback) — all
  // real, owner-uploaded images, no stock imagery.
  const roomPhotos = categories.flatMap((c) => c.image_urls ?? [])
  const baseGallery = cms.gallery_urls && cms.gallery_urls.length > 0 ? cms.gallery_urls : roomPhotos
  const gallery = (tenant.hero_image_url
    ? [tenant.hero_image_url, ...baseGallery.filter((u) => u !== tenant.hero_image_url)]
    : baseGallery
  ).slice(0, 9)

  // Amenities across all room types, plus any the owner listed on their site.
  const facilities = Array.from(new Set(
    [...categories.flatMap((c) => c.amenities ?? []), ...(cms.amenities ?? [])].map(amenityLabel),
  )).slice(0, 12)
  const faqs = (cms.faqs ?? []).filter((f) => f.q?.trim() && f.a?.trim())
  const cheapest = categories.length > 0
    ? categories.reduce((min, c) => (c.base_rate < min.base_rate ? c : min), categories[0])
    : null
  const lead = cms.hero_subheading || tenant.tagline

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'rooms', label: 'Rooms & prices' },
    ...(facilities.length > 0 ? [{ id: 'amenities', label: 'Amenities' }] : []),
    ...(location ? [{ id: 'location', label: 'Location' }] : []),
    ...(faqs.length > 0 ? [{ id: 'good-to-know', label: 'Good to know' }] : []),
    ...(testimonials.length > 0 ? [{ id: 'reviews', label: 'Reviews' }] : []),
  ]

  const contactActions = (tenant.contact_phone || tenant.contact_email) && (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {tenant.contact_phone && (
        <a
          href={`tel:${tenant.contact_phone.replace(/[^\d+]/g, '')}`}
          className="bd-focus inline-flex min-h-[44px] min-w-0 items-center gap-2.5 rounded-lg border bg-white px-4 text-[14px] font-medium transition-colors hover:bg-bd-mist"
          style={{ borderColor: MP.border, color: MP.ink }}
        >
          <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">Call </span>
          <span className="[overflow-wrap:anywhere]">{tenant.contact_phone}</span>
        </a>
      )}
      {tenant.contact_email && (
        <a
          href={`mailto:${tenant.contact_email}`}
          className="bd-focus inline-flex min-h-[44px] min-w-0 items-center gap-2.5 rounded-lg border bg-white px-4 py-2 text-[14px] font-medium transition-colors hover:bg-bd-mist"
          style={{ borderColor: MP.border, color: MP.ink }}
        >
          <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">Email </span>
          <span className="min-w-0 [overflow-wrap:anywhere]">{tenant.contact_email}</span>
        </a>
      )}
    </div>
  )

  return (
    <div className="relative min-h-screen" style={{ background: MP.bg }}>

      <MarketplaceNav />

      {/* ── Breadcrumb ──────────────────────────────────────────── */}
      <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-4 pb-1 pt-3 text-[13px] sm:px-6" style={{ color: MP.textSecondary }}>
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <li><Link href="/" className="hover:underline" style={{ color: MP.primary }}>Home</Link></li>
          <li aria-hidden="true">›</li>
          <li><Link href={browseHref()} className="hover:underline" style={{ color: MP.primary }}>{nounPlural}</Link></li>
          {tenant.address_region && (
            <>
              <li aria-hidden="true" className="hidden sm:block">›</li>
              <li className="hidden sm:block">
                <Link href={browseHref({ region: tenant.address_region })} className="hover:underline" style={{ color: MP.primary }}>
                  {tenant.address_region}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="min-w-0 truncate">{name}</li>
        </ol>
      </nav>

      <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:pb-16">
        {/* ── Summary ───────────────────────────────────────────── */}
        <header className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold" style={{ color: MP.ink, border: `1px solid ${MP.border}` }}>
              <StayIcon className="h-3.5 w-3.5" aria-hidden="true" /> {stayType}
            </p>
            <h1 className="mt-2 font-display text-[24px] font-bold leading-tight tracking-[-0.01em] [overflow-wrap:anywhere] sm:text-[30px]" style={{ color: MP.ink }}>
              {name}
            </h1>
            {location && (
              <p className="mt-1 flex items-center gap-1.5 text-[14px]" style={{ color: MP.textSecondary }}>
                <MapPin className="h-4 w-4 shrink-0" style={{ color: MP.primary }} aria-hidden="true" />
                {location}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ShareButton title={name} />
            {bookingOpen && (
              <a
                href="#rooms"
                className="bd-focus hidden min-h-[44px] items-center gap-2 rounded-lg px-5 text-[14px] font-semibold text-white transition-colors hover:bg-bd-teal-900 sm:inline-flex"
                style={{ background: MP.primary }}
              >
                See rooms <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
          </div>
        </header>

        {/* ── Photos ────────────────────────────────────────────── */}
        <div className="mt-4">
          {gallery.length > 0 ? (
            <ListingGallery photos={gallery} name={name} />
          ) : (
            <p className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px]" style={{ background: MP.surfaceSoft, color: MP.textSecondary }}>
              <ImageOff className="h-4 w-4 shrink-0" aria-hidden="true" />
              No photos yet. Contact the property if you&apos;d like to see the rooms.
            </p>
          )}
        </div>

        {/* ── Section links ─────────────────────────────────────── */}
        <nav
          aria-label="On this page"
          className="sticky z-30 -mx-4 mt-5 border-b px-4 backdrop-blur-md sm:-mx-6 sm:px-6"
          style={{ top: 'calc(4rem + env(safe-area-inset-top))', background: 'rgb(255 255 255 / 0.95)', borderColor: MP.border }}
        >
          <ul className="mp-no-scrollbar flex gap-5 overflow-x-auto text-[14px] font-medium" style={{ color: MP.textSecondary }}>
            {sections.map((s) => (
              <li key={s.id} className="shrink-0">
                <a href={`#${s.id}`} className="bd-focus block whitespace-nowrap border-b-2 border-transparent py-3 transition-colors hover:border-bd-teal/30 hover:text-bd-teal">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-6 gap-8 lg:flex">
          {/* ── Main column ─────────────────────────────────────── */}
          <div className="min-w-0 flex-1 space-y-9">
            <section id="overview" aria-labelledby="overview-heading" className="scroll-mt-32 space-y-4">
              <h2 id="overview-heading" className="sr-only">Overview</h2>
              {cms.hero_heading && cms.hero_heading !== tenant.name && cms.hero_heading !== name && (
                <p className="font-display text-[17px] font-semibold" style={{ color: MP.ink }}>{cms.hero_heading}</p>
              )}
              {lead && <p className="text-[15px] leading-relaxed" style={{ color: MP.ink }}>{lead}</p>}
              {cms.about_text && (
                <div>
                  <h3 className="text-[16px] font-bold" style={{ color: MP.ink }}>About this {isHostel ? 'hostel' : vertical === 'apartment' ? 'property' : 'hotel'}</h3>
                  <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed" style={{ color: MP.textSecondary }}>{cms.about_text}</p>
                </div>
              )}
              {contactActions && (
                <div id="contact" className="scroll-mt-32">
                  <h3 className="mb-2 text-[14px] font-semibold" style={{ color: MP.ink }}>Contact the property</h3>
                  {contactActions}
                </div>
              )}
            </section>

            {/* Rooms & prices */}
            <section id="rooms" aria-labelledby="rooms-heading" className="scroll-mt-32">
              <h2 id="rooms-heading" className="text-[19px] font-bold" style={{ color: MP.ink }}>Rooms &amp; prices</h2>
              {categories.length === 0 ? (
                <p className="mt-2 text-[14px]" style={{ color: MP.textSecondary }}>No rooms are listed yet — check back soon.</p>
              ) : (
                <>
                  {!bookingOpen && (
                    <p className="mt-2 rounded-xl px-3 py-2.5 text-[13px]" style={{ background: MP.surfaceSoft, color: MP.ink }}>
                      {name} isn&apos;t taking online bookings right now. Contact the property to ask about a room.
                    </p>
                  )}
                  <ul className="mt-3 space-y-3">
                    {categories.map((c) => {
                      const photo = c.image_urls?.[0]
                      const capacity = capacityLabel(c.capacity, tenant.business_type)
                      const bedCounts = beds.get(c.id)
                      const availability = bedCounts ? bedAvailability(bedCounts.available, bedCounts.total, tenant.business_type) : null
                      const soldOut = availability?.tone === 'full'
                      const amenities = (c.amenities ?? []).map(amenityLabel)
                      return (
                        <li key={c.id} className="flex gap-3 rounded-xl bg-white p-3 sm:gap-4 sm:p-4" style={{ border: `1px solid ${MP.border}` }}>
                          {photo && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo}
                              alt={`${c.name} at ${name}`}
                              loading="lazy"
                              decoding="async"
                              className="h-20 w-20 shrink-0 rounded-xl object-cover sm:h-28 sm:w-36"
                            />
                          )}
                          <div className="flex min-w-0 flex-1 flex-col">
                            <h3 className="text-[16px] font-semibold leading-snug [overflow-wrap:anywhere]" style={{ color: MP.ink }}>{c.name}</h3>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px]" style={{ color: MP.textSecondary }}>
                              {capacity && (
                                <span className="inline-flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5" aria-hidden="true" /> {capacity}
                                </span>
                              )}
                              {availability && bookingOpen && (
                                <span
                                  className={`inline-flex items-center gap-1 font-semibold ${
                                    availability.tone === 'full' ? 'text-bd-danger' : availability.tone === 'low' ? 'text-bd-coral-700' : 'text-bd-success'
                                  }`}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                                  {availability.label}
                                </span>
                              )}
                            </p>
                            {c.description && (
                              <p className="mt-1 line-clamp-2 text-[13px]" style={{ color: MP.textSecondary }}>{c.description}</p>
                            )}
                            {amenities.length > 0 && (
                              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Room amenities">
                                {amenities.slice(0, 4).map((a) => (
                                  <li key={a} className="rounded-full px-2 py-0.5 text-[12px]" style={{ background: MP.surfaceSoft, color: MP.ink }}>{a}</li>
                                ))}
                                {amenities.length > 4 && (
                                  <li className="px-1 py-0.5 text-[12px]" style={{ color: MP.textSecondary }}>+{amenities.length - 4} more</li>
                                )}
                              </ul>
                            )}
                            <div className="mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
                              <Price amount={c.base_rate} unit={c.rate_unit} />
                              {bookingOpen && (soldOut ? (
                                <span className="inline-flex min-h-[40px] items-center rounded-lg px-4 text-[14px] font-semibold" style={{ background: MP.surfaceSoft, color: MP.textSecondary }}>
                                  Fully booked
                                </span>
                              ) : (
                                <a
                                  href={`${bookUrl}?room=${encodeURIComponent(c.id)}`}
                                  className="bd-focus inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-4 text-[14px] font-semibold text-white transition-colors hover:bg-bd-teal-900"
                                  style={{ background: MP.primary }}
                                >
                                  {isHostel ? 'Select room' : 'Check availability'}
                                  <span className="sr-only">: {c.name}</span>
                                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                </a>
                              ))}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  {bookingOpen && (
                    <p className="mt-3 text-[12px]" style={{ color: MP.textSecondary }}>
                      You&apos;ll choose your {isHostel ? 'room and stay' : 'dates'} and pay on {name}&apos;s booking page.
                    </p>
                  )}
                </>
              )}
            </section>

            {facilities.length > 0 && (
              <section id="amenities" aria-labelledby="amenities-heading" className="scroll-mt-32">
                <h2 id="amenities-heading" className="text-[19px] font-bold" style={{ color: MP.ink }}>Amenities</h2>
                <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
                  {facilities.map((f) => {
                    const Icon = amenityIcon(f)
                    return (
                      <li key={f} className="flex items-center gap-2 text-[14px]" style={{ color: MP.ink }}>
                        <Icon className="h-4 w-4 shrink-0" style={{ color: MP.accentText }} aria-hidden="true" />
                        <span className="min-w-0 [overflow-wrap:anywhere]">{f}</span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {location && (
              <section id="location" aria-labelledby="location-heading" className="scroll-mt-32">
                <h2 id="location-heading" className="text-[19px] font-bold" style={{ color: MP.ink }}>Location</h2>
                <p className="mt-2 flex items-start gap-2 text-[14px]" style={{ color: MP.ink }}>
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: MP.primary }} aria-hidden="true" />
                  {fullAddress}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${tenant.name}, ${fullAddress}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bd-focus inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border bg-white px-3.5 text-[14px] font-medium hover:bg-bd-mist"
                    style={{ borderColor: MP.border, color: MP.ink }}
                  >
                    View on map <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">(opens Google Maps in a new tab)</span>
                  </a>
                  {tenant.address_city && (
                    <Link
                      href={browseHref({ city: tenant.address_city })}
                      className="bd-focus inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border bg-white px-3.5 text-[14px] font-medium hover:bg-bd-mist"
                      style={{ borderColor: MP.border, color: MP.ink }}
                    >
                      More {nounPlural.toLowerCase()} in {city}
                    </Link>
                  )}
                </div>
              </section>
            )}

            {faqs.length > 0 && (
              <section id="good-to-know" aria-labelledby="faq-heading" className="scroll-mt-32">
                <h2 id="faq-heading" className="text-[19px] font-bold" style={{ color: MP.ink }}>Good to know</h2>
                <div className="mt-3 divide-y overflow-hidden rounded-xl bg-white" style={{ border: `1px solid ${MP.border}`, borderColor: MP.border }}>
                  {faqs.map((f, i) => (
                    <details key={i} className="group px-4" style={{ borderColor: MP.border }}>
                      <summary className="bd-focus flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 py-3 text-[14px] font-semibold [&::-webkit-details-marker]:hidden" style={{ color: MP.ink }}>
                        {f.q}
                        <span className="text-[18px] leading-none transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                      </summary>
                      <p className="whitespace-pre-line pb-4 text-[14px] leading-relaxed" style={{ color: MP.textSecondary }}>{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* Guest reviews — real, staff-moderated occupant_feedback,
                never the platform's own marketplace reviews. */}
            {testimonials.length > 0 && (
              <section id="reviews" aria-labelledby="reviews-heading" className="scroll-mt-32">
                <h2 id="reviews-heading" className="text-[19px] font-bold" style={{ color: MP.ink }}>What residents say</h2>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {testimonials.map((t, i) => {
                    const occ = Array.isArray(t.occupants) ? t.occupants[0] : t.occupants
                    return (
                      <figure key={i} className="rounded-xl bg-white p-4" style={{ border: `1px solid ${MP.border}` }}>
                        <div className="flex items-center gap-0.5" role="img" aria-label={`Rated ${t.overall_rating} out of 5`}>
                          {Array.from({ length: 5 }).map((_, s) => (
                            <Star
                              key={s}
                              className="h-3.5 w-3.5"
                              style={{ color: MP.accentText, fill: s < t.overall_rating ? MP.accentText : 'transparent' }}
                              aria-hidden="true"
                            />
                          ))}
                        </div>
                        <blockquote className="mt-2 text-[14px] leading-relaxed" style={{ color: MP.textSecondary }}>&ldquo;{t.comments}&rdquo;</blockquote>
                        <figcaption className="mt-2 text-[12px] font-semibold" style={{ color: MP.ink }}>
                          {occ ? `${occ.first_name} ${occ.last_name.charAt(0)}.` : 'Resident'}
                        </figcaption>
                      </figure>
                    )
                  })}
                </div>
              </section>
            )}
          </div>

          {/* ── Sidebar ───────────────────────────────────────────── */}
          <aside className="mt-9 w-full shrink-0 lg:mt-0 lg:w-80">
            <div className="space-y-4 lg:sticky" style={{ top: 'calc(7.5rem + env(safe-area-inset-top))' }}>
              {cheapest && (
                <div className="hidden rounded-xl bg-white p-5 lg:block" style={{ border: `1px solid ${MP.border}` }}>
                  <Price amount={cheapest.base_rate} unit={cheapest.rate_unit} from size="lg" />
                  <p className="mt-1 text-[13px]" style={{ color: MP.textSecondary }}>
                    {categories.length} room type{categories.length === 1 ? '' : 's'} · {stayType.toLowerCase()}
                  </p>
                  {bookingOpen ? (
                    <a
                      href="#rooms"
                      className="bd-focus mt-4 flex min-h-[44px] items-center justify-center gap-2 rounded-lg text-[15px] font-semibold text-white transition-colors hover:bg-bd-teal-900"
                      style={{ background: MP.primary }}
                    >
                      See rooms &amp; prices
                    </a>
                  ) : (
                    <p className="mt-3 text-[13px]" style={{ color: MP.ink }}>Online booking is paused — contact the property.</p>
                  )}
                </div>
              )}

              <div className="rounded-xl bg-white p-5" style={{ border: `1px solid ${MP.border}` }}>
                <h2 className="text-[14px] font-semibold" style={{ color: MP.ink }}>Already have a room here?</h2>
                <p className="mt-1 text-[13px]" style={{ color: MP.textSecondary }}>
                  If {name} sent you login details, sign in to your {isHostel ? 'student' : 'guest'} portal.
                </p>
                <Link
                  href="/login"
                  className="bd-focus mt-3 flex min-h-[40px] w-full items-center justify-center rounded-lg text-[14px] font-semibold transition-colors hover:bg-bd-mist"
                  style={{ border: `1px solid ${MP.border}`, color: MP.ink }}
                >
                  Sign in
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Phone booking bar — price + next step always in reach ── */}
      {cheapest && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 px-4 pt-3 backdrop-blur-md lg:hidden"
          style={{ borderColor: MP.border, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <Price amount={cheapest.base_rate} unit={cheapest.rate_unit} from />
            <a
              href={bookingOpen ? '#rooms' : contactActions ? '#contact' : '#rooms'}
              className="bd-focus inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg px-5 text-[15px] font-semibold text-white transition-colors hover:bg-bd-teal-900"
              style={{ background: MP.primary }}
            >
              {bookingOpen ? 'See rooms' : 'Contact'}
            </a>
          </div>
        </div>
      )}

      <MarketplaceFooter />
      {/* Room for the fixed phone booking bar below the footer. */}
      {cheapest && <div className="h-20 bg-bd-mist lg:hidden" aria-hidden="true" />}
    </div>
  )
}
