import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Mail, BedDouble } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGHS } from '@/lib/utils'
import { amenityIcon } from '@/lib/amenity-icons'
import { tenantHost, bareRootDomain, type BusinessType } from '@/lib/tenant/host-classification'
import { MarketplaceNav } from '@/components/marketplace/marketplace-nav'
import { MarketplaceFooter } from '@/components/marketplace/marketplace-footer'
import { ShareButton } from '@/components/public/share-button'
import { MP } from '@/lib/marketplace-theme'

interface CmsContent {
  hero_heading?:    string | null
  hero_subheading?: string | null
  about_text?:      string | null
  amenities?:       string[]
  gallery_urls?:    string[]
}

async function getListing(slug: string) {
  const supabase = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug, name, tagline, logo_url, hero_image_url, primary_color, contact_phone, contact_email, address_city, address_region, custom_domain, website_content, listed_publicly, status, business_type')
    .eq('slug', slug)
    .single()

  if (!tenant || !tenant.listed_publicly || !['trial', 'active', 'trial_expired'].includes(tenant.status)) {
    return null
  }

  const { data: categories } = await supabase
    .from('room_categories')
    .select('id, name, type, base_rate, rate_unit, capacity, amenities, description, image_urls')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('sort_order')

  return { tenant, categories: categories ?? [] }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const result = await getListing(slug)
  if (!result) return { title: 'Property Not Found' }
  return {
    title: `${result.tenant.name} — Aya`,
    description: result.tenant.tagline ?? `Book a room at ${result.tenant.name} in ${result.tenant.address_city ?? 'Ghana'}.`,
  }
}

export default async function ListingProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await getListing(slug)
  if (!result) notFound()

  const { tenant, categories } = result
  const cms = (tenant.website_content ?? {}) as CmsContent
  const isHotel = tenant.business_type === 'hotel'
  const nounSingular = isHotel ? 'hotel' : 'hostel'
  const rootDomain = bareRootDomain(process.env.NEXT_PUBLIC_APP_DOMAIN)
  const bookUrl = tenant.custom_domain
    ? `https://${tenant.custom_domain}/book`
    : `https://${tenantHost(tenant.slug, tenant.business_type as BusinessType, rootDomain)}/book`

  const location = [tenant.address_city, tenant.address_region].filter(Boolean).join(', ')

  // Gallery: the owner's property photo leads when set, followed by the CMS
  // gallery (or every room photo across categories as a fallback) — all
  // real, owner-uploaded images, no stock imagery.
  const roomPhotos = categories.flatMap((c) => c.image_urls ?? [])
  const baseGallery = cms.gallery_urls && cms.gallery_urls.length > 0 ? cms.gallery_urls : roomPhotos
  const gallery = (tenant.hero_image_url
    ? [tenant.hero_image_url, ...baseGallery.filter((u) => u !== tenant.hero_image_url)]
    : baseGallery
  ).slice(0, 9)

  // Most popular facilities: dedupe amenities across all room categories.
  const facilities = Array.from(new Set(categories.flatMap((c) => c.amenities ?? []))).slice(0, 10)
  const minCapacity = categories.length > 0 ? Math.min(...categories.map((c) => c.capacity)) : null

  return (
    <div className="relative min-h-screen" style={{ background: MP.bg }}>
      <div className="pointer-events-none fixed inset-0 -z-10 platform-adinkra-bg-light" aria-hidden="true" />

      <MarketplaceNav />

      {/* ── Breadcrumb ──────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-3 text-[13px] sm:px-6" style={{ color: MP.textSecondary }}>
        <Link href="/" className="hover:underline" style={{ color: MP.green }}>Home</Link>
        <span className="mx-1.5">›</span>
        <Link href="/browse" className="hover:underline" style={{ color: MP.green }}>{isHotel ? 'Hotels' : 'Hostels'}</Link>
        {tenant.address_region && (
          <>
            <span className="mx-1.5">›</span>
            <Link href={`/browse?region=${encodeURIComponent(tenant.address_region)}`} className="hover:underline" style={{ color: MP.green }}>
              {tenant.address_region}
            </Link>
          </>
        )}
        <span className="mx-1.5">›</span>
        <span>{tenant.name}</span>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-[26px] font-bold" style={{ color: MP.ink }}>{cms.hero_heading || tenant.name}</h1>
            {location && (
              <p className="mt-1 flex items-center gap-1.5 text-sm" style={{ color: MP.textSecondary }}>
                <MapPin className="h-4 w-4" style={{ color: MP.green }} />
                {location}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ShareButton title={tenant.name} />
            {categories.length > 0 && (
              <a
                href={bookUrl}
                className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                style={{ background: MP.green }}
              >
                Reserve
              </a>
            )}
          </div>
        </div>

        {/* ── Gallery ───────────────────────────────────────────── */}
        {gallery.length > 0 ? (
          <div className="mp-reveal mt-5 grid grid-cols-2 gap-2 overflow-hidden rounded-xl sm:grid-cols-4 sm:grid-rows-2">
            <div className="col-span-2 row-span-2 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gallery[0]}
                alt={tenant.name}
                className="aspect-[4/3] w-full rounded-l-xl object-cover transition-transform duration-500 hover:scale-105 sm:aspect-auto sm:h-full"
              />
            </div>
            {gallery.slice(1, 5).map((url, i) => (
              <div key={i} className="overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${tenant.name} photo ${i + 2}`}
                  className={`aspect-square w-full object-cover transition-transform duration-500 hover:scale-105 sm:aspect-auto sm:h-full ${i === 1 ? 'sm:rounded-tr-xl' : ''} ${i === 3 ? 'sm:rounded-br-xl' : ''}`}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 flex aspect-[16/7] w-full items-center justify-center rounded-xl" style={{ background: MP.surfaceSoft }}>
            <BedDouble className="h-10 w-10" style={{ color: MP.goldDeep, opacity: 0.4 }} />
          </div>
        )}

        <div className="mt-8 gap-8 lg:flex">
          {/* ── Main column ─────────────────────────────────────── */}
          <div className="min-w-0 flex-1 space-y-10">
            {/* Tabs (in-page anchors) */}
            <div className="flex gap-6 text-[14px] font-medium" style={{ borderBottom: `1px solid ${MP.border}`, color: MP.textSecondary }}>
              <a href="#overview" className="pb-3 transition-opacity" style={{ borderBottom: `2px solid ${MP.green}`, color: MP.green }}>Overview</a>
              <a href="#rooms" className="pb-3 transition-opacity hover:opacity-70">Rooms &amp; Prices</a>
              {facilities.length > 0 && <a href="#facilities" className="pb-3 transition-opacity hover:opacity-70">Facilities</a>}
            </div>

            <section id="overview" className="space-y-3">
              {(cms.hero_subheading || tenant.tagline) && (
                <p className="text-[15px] leading-relaxed" style={{ color: MP.ink }}>{cms.hero_subheading || tenant.tagline}</p>
              )}
              {cms.about_text && (
                <div>
                  <h2 className="text-[17px] font-bold" style={{ color: MP.ink }}>About this {nounSingular}</h2>
                  <p className="mt-2 text-[14px] leading-relaxed" style={{ color: MP.textSecondary }}>{cms.about_text}</p>
                </div>
              )}
              {(tenant.contact_phone || tenant.contact_email) && (
                <div className="flex flex-wrap gap-4 pt-2 text-[13px]" style={{ color: MP.textSecondary }}>
                  {tenant.contact_phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {tenant.contact_phone}</span>}
                  {tenant.contact_email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {tenant.contact_email}</span>}
                </div>
              )}
            </section>

            {/* Rooms & Prices */}
            <section id="rooms">
              <h2 className="text-[17px] font-bold" style={{ color: MP.ink }}>Rooms &amp; Prices</h2>
              {categories.length === 0 ? (
                <p className="mt-3 text-sm" style={{ color: MP.textSecondary }}>No rooms currently listed — check back soon.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {categories.map((c, i) => (
                    <div
                      key={c.id}
                      className="mp-reveal flex flex-col gap-4 rounded-xl bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center"
                      style={{ border: `1px solid ${MP.border}`, animationDelay: `${Math.min(i, 6) * 50}ms` }}
                    >
                      {c.image_urls && c.image_urls.length > 0 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image_urls[0]} alt={c.name} className="h-32 w-full shrink-0 rounded-lg object-cover sm:h-20 sm:w-28" />
                      ) : (
                        <div className="flex h-32 w-full shrink-0 items-center justify-center rounded-lg sm:h-20 sm:w-28" style={{ background: MP.surfaceSoft }}>
                          <BedDouble className="h-6 w-6" style={{ color: MP.goldDeep, opacity: 0.4 }} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold" style={{ color: MP.ink }}>{c.name}</p>
                        {c.description && <p className="mt-0.5 text-[13px]" style={{ color: MP.textSecondary }}>{c.description}</p>}
                        {c.amenities && c.amenities.length > 0 && (
                          <p className="mt-1 text-[12px]" style={{ color: MP.textSecondary, opacity: 0.8 }}>{c.amenities.slice(0, 5).join(' · ')}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[18px] font-bold" style={{ color: MP.ink }}>{formatGHS(c.base_rate)}</p>
                        <p className="text-[12px]" style={{ color: MP.textSecondary }}>per {c.rate_unit}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Facilities */}
            {facilities.length > 0 && (
              <section id="facilities">
                <h2 className="text-[17px] font-bold" style={{ color: MP.ink }}>Most popular facilities</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {facilities.map((f, i) => {
                    const Icon = amenityIcon(f)
                    return (
                      <div
                        key={f}
                        className="mp-reveal flex items-center gap-2 text-[13px]"
                        style={{ color: MP.ink, animationDelay: `${Math.min(i, 9) * 30}ms` }}
                      >
                        <Icon className="h-4 w-4 shrink-0" style={{ color: MP.goldDeep }} />
                        {f}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </div>

          {/* ── Sidebar ───────────────────────────────────────────── */}
          <aside className="mt-8 w-full shrink-0 lg:mt-0 lg:w-72">
            <div className="sticky top-4 space-y-4">
              <div className="rounded-xl bg-white p-5" style={{ border: `1px solid ${MP.border}` }}>
                <h3 className="text-[15px] font-bold" style={{ color: MP.ink }}>Property highlights</h3>
                <ul className="mt-3 space-y-2.5 text-[13px]" style={{ color: MP.textSecondary }}>
                  <li>{categories.length} room type{categories.length === 1 ? '' : 's'} available</li>
                  {minCapacity != null && <li>From {minCapacity} guest{minCapacity === 1 ? '' : 's'} per room</li>}
                  {location && <li>Located in {location}</li>}
                </ul>
              </div>

              <div className="rounded-xl bg-white p-5" style={{ border: `1px solid ${MP.border}` }}>
                <h3 className="text-[14px] font-semibold" style={{ color: MP.ink }}>Already have a room here?</h3>
                <p className="mt-1.5 text-[13px]" style={{ color: MP.textSecondary }}>
                  If {tenant.name} already sent you login details, sign in to your {isHotel ? 'guest' : 'student'} portal.
                </p>
                <Link
                  href="/login"
                  className="mt-3 inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-neutral-50"
                  style={{ border: `1px solid ${MP.border}`, color: MP.ink }}
                >
                  Sign in
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <MarketplaceFooter />
    </div>
  )
}
