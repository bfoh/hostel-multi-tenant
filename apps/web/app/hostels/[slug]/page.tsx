import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { MapPin, Phone, Mail, ArrowLeft, BedDouble } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGHS } from '@/lib/utils'

const INK = '#0A0A08'
const IVORY = '#F5E9D2'
const GOLD = '#D4A24C'
const GOLD_SOFT = '#F5C26B'
const HAIR = 'rgba(245,233,210,0.10)'
const HAIR_STRONG = 'rgba(245,233,210,0.18)'
const FOREST_MID = '#1B6E54'

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

  return (
    <div className="min-h-screen text-[#f5e9d2] antialiased" style={{ background: INK }}>
      <nav
        className="sticky top-0 z-50 backdrop-blur-2xl"
        style={{ background: 'rgba(10,10,8,0.72)', borderBottom: `1px solid ${HAIR}` }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/hostels" className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: 'rgba(245,233,210,0.6)' }}>
            <ArrowLeft className="h-3.5 w-3.5" /> All hostels
          </Link>
          <Image src="/logo-mark.svg" alt="GH Hostels" width={28} height={28} />
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="flex items-start gap-4">
          {tenant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logo_url} alt={tenant.name} className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
          ) : (
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: `linear-gradient(135deg, ${FOREST_MID}, ${GOLD})` }}
            >
              <span className="text-[22px] font-bold text-white">{tenant.name.slice(0, 1).toUpperCase()}</span>
            </div>
          )}
          <div>
            <h1 className="text-[26px] font-normal leading-tight" style={{ fontFamily: 'Georgia, serif', color: IVORY }}>
              {cms.hero_heading || tenant.name}
            </h1>
            {(tenant.address_city || tenant.address_region) && (
              <p className="mt-1 flex items-center gap-1 text-sm" style={{ color: 'rgba(245,233,210,0.55)' }}>
                <MapPin className="h-3.5 w-3.5" />
                {[tenant.address_city, tenant.address_region].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>

        {(cms.hero_subheading || tenant.tagline) && (
          <p className="mt-6 text-[15px] leading-relaxed" style={{ color: 'rgba(245,233,210,0.7)' }}>
            {cms.hero_subheading || tenant.tagline}
          </p>
        )}

        {cms.about_text && (
          <p className="mt-4 text-sm leading-relaxed" style={{ color: 'rgba(245,233,210,0.6)' }}>
            {cms.about_text}
          </p>
        )}

        {cms.gallery_urls && cms.gallery_urls.length > 0 && (
          <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {cms.gallery_urls.slice(0, 8).map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt="" className="aspect-square w-full rounded-xl object-cover" />
            ))}
          </div>
        )}

        {/* Room types */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold" style={{ color: IVORY }}>Rooms &amp; pricing</h2>
          {categories.length === 0 ? (
            <p className="mt-3 text-sm" style={{ color: 'rgba(245,233,210,0.5)' }}>
              No rooms currently listed — check back soon.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-4 rounded-2xl p-4"
                  style={{ border: `1px solid ${HAIR_STRONG}`, background: 'rgba(245,233,210,0.03)' }}
                >
                  <div className="flex items-center gap-3">
                    <BedDouble className="h-5 w-5 shrink-0" style={{ color: GOLD }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: IVORY }}>{c.name}</p>
                      {c.description && (
                        <p className="mt-0.5 max-w-md text-xs" style={{ color: 'rgba(245,233,210,0.5)' }}>{c.description}</p>
                      )}
                      {c.amenities && c.amenities.length > 0 && (
                        <p className="mt-1 text-[11px]" style={{ color: 'rgba(245,233,210,0.4)' }}>
                          {c.amenities.slice(0, 5).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold" style={{ color: GOLD_SOFT }}>
                    {formatGHS(c.base_rate)} / {c.rate_unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact + book CTA */}
        <div
          className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl p-5 sm:flex-row sm:items-center"
          style={{ border: `1px solid ${HAIR_STRONG}`, background: 'linear-gradient(180deg, rgba(15,76,58,0.18) 0%, rgba(15,76,58,0.04) 100%)' }}
        >
          <div className="space-y-1 text-sm" style={{ color: 'rgba(245,233,210,0.6)' }}>
            {tenant.contact_phone && (
              <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {tenant.contact_phone}</p>
            )}
            {tenant.contact_email && (
              <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {tenant.contact_email}</p>
            )}
          </div>
          {categories.length > 0 && (
            <a
              href={bookUrl}
              className="shrink-0 rounded-full px-6 py-3 text-sm font-semibold"
              style={{ background: GOLD, color: INK }}
            >
              Book now
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
