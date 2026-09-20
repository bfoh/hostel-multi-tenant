import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Mail, ArrowLeft, BedDouble, Heart, Share2 } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGHS } from '@/lib/utils'
import { amenityIcon } from '@/lib/amenity-icons'

interface CmsContent {
  hero_heading?:    string | null
  hero_subheading?: string | null
  about_text?:      string | null
  amenities?:       string[]
  gallery_urls?:    string[]
}

async function getHostel(slug: string) {
  const supabase = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug, name, tagline, logo_url, primary_color, contact_phone, contact_email, address_city, address_region, custom_domain, website_content, listed_publicly, status')
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
  const result = await getHostel(slug)
  if (!result) return { title: 'Hostel Not Found' }
  return {
    title: `${result.tenant.name} — GH Hostels`,
    description: result.tenant.tagline ?? `Book a room at ${result.tenant.name} in ${result.tenant.address_city ?? 'Ghana'}.`,
  }
}

export default async function HostelProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await getHostel(slug)
  if (!result) notFound()

  const { tenant, categories } = result
  const cms = (tenant.website_content ?? {}) as CmsContent
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
  const rootDomain = appDomain.startsWith('app.') ? appDomain.slice(4) : appDomain
  const bookUrl = tenant.custom_domain
    ? `https://${tenant.custom_domain}/book`
    : `https://${tenant.slug}.${rootDomain}/book`

  const location = [tenant.address_city, tenant.address_region].filter(Boolean).join(', ')

  // Gallery: prefer the CMS gallery, fall back to every room photo across
  // categories (real, owner-uploaded — no stock imagery).
  const roomPhotos = categories.flatMap((c) => c.image_urls ?? [])
  const gallery = (cms.gallery_urls && cms.gallery_urls.length > 0 ? cms.gallery_urls : roomPhotos).slice(0, 9)

  // Most popular facilities: dedupe amenities across all room categories.
  const facilities = Array.from(new Set(categories.flatMap((c) => c.amenities ?? []))).slice(0, 10)
  const minCapacity = categories.length > 0 ? Math.min(...categories.map((c) => c.capacity)) : null

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <div className="bg-[#003580] py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-mark.svg" alt="GH Hostels" width={26} height={26} className="rounded" />
            <span className="text-[13px] font-bold tracking-wide text-white">GH-HOSTELS</span>
          </Link>
          <Link href="/hostels" className="flex items-center gap-1.5 text-[13px] font-medium text-white/90 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> All hostels
          </Link>
        </div>
      </div>

      {/* ── Breadcrumb ──────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-3 text-[13px] text-neutral-500 sm:px-6">
        <Link href="/" className="text-[#0071c2] hover:underline">Home</Link>
        <span className="mx-1.5">›</span>
        <Link href="/hostels" className="text-[#0071c2] hover:underline">Hostels</Link>
        {tenant.address_region && (
          <>
            <span className="mx-1.5">›</span>
            <Link href={`/hostels?region=${encodeURIComponent(tenant.address_region)}`} className="text-[#0071c2] hover:underline">
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
            <h1 className="text-[26px] font-bold text-neutral-900">{cms.hero_heading || tenant.name}</h1>
            {location && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-600">
                <MapPin className="h-4 w-4 text-[#0071c2]" />
                {location}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 hover:bg-neutral-100" aria-label="Save">
              <Heart className="h-4 w-4" />
            </button>
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 hover:bg-neutral-100" aria-label="Share">
              <Share2 className="h-4 w-4" />
            </button>
            {categories.length > 0 && (
              <a
                href={bookUrl}
                className="rounded-lg bg-[#0071c2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00487a]"
              >
                Reserve
              </a>
            )}
          </div>
        </div>

        {/* ── Gallery ───────────────────────────────────────────── */}
        {gallery.length > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:grid-rows-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gallery[0]} alt={tenant.name} className="col-span-2 row-span-2 aspect-[4/3] w-full rounded-l-xl object-cover sm:aspect-auto sm:h-full" />
            {gallery.slice(1, 5).map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt=""
                className={`aspect-square w-full object-cover sm:aspect-auto sm:h-full ${i === 1 ? 'sm:rounded-tr-xl' : ''} ${i === 3 ? 'sm:rounded-br-xl' : ''}`}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 flex aspect-[16/7] w-full items-center justify-center rounded-xl bg-neutral-100">
            <BedDouble className="h-10 w-10 text-neutral-300" />
          </div>
        )}

        <div className="mt-8 gap-8 lg:flex">
          {/* ── Main column ─────────────────────────────────────── */}
          <div className="min-w-0 flex-1 space-y-10">
            {/* Tabs (in-page anchors) */}
            <div className="flex gap-6 border-b border-neutral-200 text-[14px] font-medium text-neutral-500">
              <a href="#overview" className="border-b-2 border-[#0071c2] pb-3 text-[#0071c2]">Overview</a>
              <a href="#rooms" className="pb-3 hover:text-neutral-800">Rooms &amp; Prices</a>
              {facilities.length > 0 && <a href="#facilities" className="pb-3 hover:text-neutral-800">Facilities</a>}
            </div>

            <section id="overview" className="space-y-3">
              {(cms.hero_subheading || tenant.tagline) && (
                <p className="text-[15px] leading-relaxed text-neutral-800">{cms.hero_subheading || tenant.tagline}</p>
              )}
              {cms.about_text && (
                <div>
                  <h2 className="text-[17px] font-bold text-neutral-900">About this hostel</h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">{cms.about_text}</p>
                </div>
              )}
              {(tenant.contact_phone || tenant.contact_email) && (
                <div className="flex flex-wrap gap-4 pt-2 text-[13px] text-neutral-600">
                  {tenant.contact_phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {tenant.contact_phone}</span>}
                  {tenant.contact_email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {tenant.contact_email}</span>}
                </div>
              )}
            </section>

            {/* Rooms & Prices */}
            <section id="rooms">
              <h2 className="text-[17px] font-bold text-neutral-900">Rooms &amp; Prices</h2>
              {categories.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-500">No rooms currently listed — check back soon.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {categories.map((c) => (
                    <div key={c.id} className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center">
                      {c.image_urls && c.image_urls.length > 0 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image_urls[0]} alt={c.name} className="h-32 w-full shrink-0 rounded-lg object-cover sm:h-20 sm:w-28" />
                      ) : (
                        <div className="flex h-32 w-full shrink-0 items-center justify-center rounded-lg bg-neutral-100 sm:h-20 sm:w-28">
                          <BedDouble className="h-6 w-6 text-neutral-300" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold text-neutral-900">{c.name}</p>
                        {c.description && <p className="mt-0.5 text-[13px] text-neutral-500">{c.description}</p>}
                        {c.amenities && c.amenities.length > 0 && (
                          <p className="mt-1 text-[12px] text-neutral-400">{c.amenities.slice(0, 5).join(' · ')}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[18px] font-bold text-neutral-900">{formatGHS(c.base_rate)}</p>
                        <p className="text-[12px] text-neutral-500">per {c.rate_unit}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Facilities */}
            {facilities.length > 0 && (
              <section id="facilities">
                <h2 className="text-[17px] font-bold text-neutral-900">Most popular facilities</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {facilities.map((f) => {
                    const Icon = amenityIcon(f)
                    return (
                      <div key={f} className="flex items-center gap-2 text-[13px] text-neutral-700">
                        <Icon className="h-4 w-4 shrink-0 text-[#008009]" />
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
              <div className="rounded-xl border border-neutral-200 bg-white p-5">
                <h3 className="text-[15px] font-bold text-neutral-900">Property highlights</h3>
                <ul className="mt-3 space-y-2.5 text-[13px] text-neutral-600">
                  <li>{categories.length} room type{categories.length === 1 ? '' : 's'} available</li>
                  {minCapacity != null && <li>From {minCapacity} guest{minCapacity === 1 ? '' : 's'} per room</li>}
                  {location && <li>Located in {location}</li>}
                </ul>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-white p-5">
                <h3 className="text-[14px] font-semibold text-neutral-900">Already have a room here?</h3>
                <p className="mt-1.5 text-[13px] text-neutral-500">
                  If your hostel management already sent you login details, sign in to your student portal.
                </p>
                <Link
                  href="/login"
                  className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-neutral-300 px-4 py-2 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
