import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { Phone, Mail, MapPin, Wifi, Wind, Droplets, Zap, Shield, Car, Utensils, Dumbbell, BookOpen } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGHS } from '@/lib/utils'
import { BookingFlow } from '@/components/public/booking-flow'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Dynamic metadata per hostel
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantFromRequest()
  if (!tenant) return { title: 'Book a Room' }

  return {
    title: `Book a Room — ${tenant.name}`,
    description: tenant.tagline ?? `Book accommodation at ${tenant.name}. Check availability and reserve your room online.`,
    openGraph: {
      title: `${tenant.name} — Book a Room`,
      description: tenant.tagline ?? `Book accommodation at ${tenant.name}.`,
      images: tenant.logo_url ? [{ url: tenant.logo_url }] : [],
    },
  }
}

interface CmsContent {
  hero_heading?:    string | null
  hero_subheading?: string | null
  about_text?:      string | null
  amenities?:       string[]
  gallery_urls?:    string[]
  faqs?:            { q: string; a: string }[]
}

interface TenantRow {
  id: string
  slug: string
  name: string
  tagline: string | null
  logo_url: string | null
  primary_color: string | null
  contact_phone: string | null
  contact_email: string | null
  address_line1: string | null
  address_city: string | null
  address_region: string | null
  website_url: string | null
  website_content: CmsContent
}

async function getTenantFromRequest(): Promise<TenantRow | null> {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('tenants')
    .select('id, slug, name, tagline, logo_url, primary_color, contact_phone, contact_email, address_line1, address_city, address_region, website_url, website_content')
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

  return ((catData ?? []) as unknown as RawCategory[]).map(cat => {
    const occ = occByCat.get(cat.id) ?? { available: 0, total: 0 }
    return {
      id:          cat.id,
      name:        cat.name,
      type:        cat.type,
      base_rate:   cat.base_rate,
      rate_unit:   cat.rate_unit,
      capacity:    cat.capacity,
      amenities:   cat.amenities ?? [],
      description: cat.description ?? null,
      image_urls:  cat.image_urls ?? [],
      available:   occ.available,
      total:       occ.total,
    }
  })
}

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  'wifi':          <Wifi className="h-4 w-4" />,
  'ac':            <Wind className="h-4 w-4" />,
  'water':         <Droplets className="h-4 w-4" />,
  'electricity':   <Zap className="h-4 w-4" />,
  'security':      <Shield className="h-4 w-4" />,
  'parking':       <Car className="h-4 w-4" />,
  'canteen':       <Utensils className="h-4 w-4" />,
  'gym':           <Dumbbell className="h-4 w-4" />,
  'study room':    <BookOpen className="h-4 w-4" />,
}

const RATE_LABEL: Record<string, string> = {
  night:    '/ night',
  week:     '/ week',
  month:    '/ month',
  semester: '/ semester',
}

export default async function PublicBookingPage() {
  const tenant = await getTenantFromRequest()
  if (!tenant) notFound()

  const categories = await getRoomCategories(tenant.id)
  const brandColor = tenant.primary_color ?? '#2563EB'
  const cms: CmsContent = tenant.website_content ?? {}

  return (
    <>
      {/* ── CSS variable for brand color ─────────────────────────── */}
      <style>{`:root { --brand: ${brandColor}; }`}</style>

      <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Inter, sans-serif' }}>
        {/* ── Header / Hero ─────────────────────────────────────────── */}
        <header style={{ background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}CC 100%)` }}>
          <div className="mx-auto max-w-5xl px-4 py-10 text-white">
            <div className="flex items-center gap-4">
              {tenant.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenant.logo_url} alt={tenant.name} className="h-14 w-14 rounded-xl object-cover bg-white/20 p-1" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 text-2xl font-bold">
                  {tenant.name[0]}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">
                  {cms.hero_heading ?? tenant.name}
                </h1>
                <p className="mt-0.5 text-white/80 text-sm">
                  {cms.hero_subheading ?? tenant.tagline ?? ''}
                </p>
              </div>
            </div>

            {/* Contact strip */}
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-white/80">
              {tenant.contact_phone && (
                <a href={`tel:${tenant.contact_phone}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
                  <Phone className="h-3.5 w-3.5" />
                  {tenant.contact_phone}
                </a>
              )}
              {tenant.contact_email && (
                <a href={`mailto:${tenant.contact_email}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
                  <Mail className="h-3.5 w-3.5" />
                  {tenant.contact_email}
                </a>
              )}
              {(tenant.address_city || tenant.address_region) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {[tenant.address_line1, tenant.address_city, tenant.address_region].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* ── Main content ──────────────────────────────────────────── */}
        <main className="mx-auto max-w-5xl px-4 py-10 space-y-12">

          {/* Amenities */}
          {cms.amenities && cms.amenities.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Facilities &amp; Amenities</h2>
              <div className="flex flex-wrap gap-2">
                {cms.amenities.map((a) => {
                  const Icon = AMENITY_ICONS[a.toLowerCase()] ?? null
                  return (
                    <span key={a} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700">
                      {Icon}
                      {a}
                    </span>
                  )
                })}
              </div>
            </section>
          )}

          {/* About */}
          {cms.about_text && (
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">About Us</h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{cms.about_text}</p>
            </section>
          )}

          {/* Gallery */}
          {cms.gallery_urls && cms.gallery_urls.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Gallery</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {cms.gallery_urls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt={`${tenant.name} photo ${i + 1}`}
                    className="aspect-video w-full rounded-xl object-cover bg-gray-100"
                    loading="lazy"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Room booking */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Available Rooms</h2>
            <p className="text-sm text-gray-500 mb-6">Choose a room type to start your booking. All prices are in Ghana Cedis (GH₵).</p>

            {categories.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
                <p className="text-gray-500">No rooms available at this time. Please contact the hostel directly.</p>
                {tenant.contact_phone && (
                  <a href={`tel:${tenant.contact_phone}`} className="mt-4 inline-block rounded-lg px-6 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: brandColor }}>
                    Call {tenant.contact_phone}
                  </a>
                )}
              </div>
            ) : (
              <BookingFlow
                categories={categories}
                tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug, brandColor }}
              />
            )}
          </section>

          {/* FAQ */}
          {cms.faqs && cms.faqs.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
              <div className="space-y-3">
                {cms.faqs.map((faq, i) => (
                  <details key={i} className="group rounded-xl border border-gray-200 bg-white">
                    <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-gray-800 list-none">
                      {faq.q}
                      <span className="ml-3 shrink-0 text-gray-400 group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <p className="border-t border-gray-100 px-5 py-4 text-sm text-gray-600 leading-relaxed">
                      {faq.a}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </main>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <footer className="border-t border-gray-100 bg-white py-8 mt-12">
          <div className="mx-auto max-w-5xl px-4 text-center text-xs text-gray-400">
            <p>{tenant.name} · Powered by <span className="font-semibold">GH Hostels</span></p>
            {tenant.contact_phone && (
              <p className="mt-1">
                Questions? Call or WhatsApp{' '}
                <a href={`https://wa.me/${tenant.contact_phone.replace(/\D/g, '').replace(/^0/, '233')}`}
                   target="_blank" rel="noopener noreferrer"
                   className="font-medium" style={{ color: brandColor }}>
                  {tenant.contact_phone}
                </a>
              </p>
            )}
          </div>
        </footer>
      </div>
    </>
  )
}
