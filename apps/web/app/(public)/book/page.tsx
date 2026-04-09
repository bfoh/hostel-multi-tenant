import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { Phone, Mail, MapPin, Wifi, Wind, Droplets, Zap, Shield, Car, Utensils, Dumbbell, BookOpen } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGHS } from '@/lib/utils'
import { BookingFlow } from '@/components/public/booking-flow'

export const revalidate = 300 // ISR: re-render at most every 5 minutes

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
}

async function getTenantFromRequest(): Promise<TenantRow | null> {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('tenants')
    .select('id, slug, name, tagline, logo_url, primary_color, contact_phone, contact_email, address_line1, address_city, address_region, website_url')
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
  rooms: { id: string; status: string }[] | null
}

async function getRoomCategories(tenantId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('room_categories')
    .select('id, name, type, base_rate, rate_unit, capacity, amenities, description, image_urls, rooms(id, status)')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order')

  return ((data ?? []) as unknown as RawCategory[]).map(cat => {
    const rooms = Array.isArray(cat.rooms) ? cat.rooms : []
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
      available:   rooms.filter(r => r.status === 'available').length,
      total:       rooms.length,
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

  return (
    <>
      {/* ── CSS variable for brand color ─────────────────────────── */}
      <style>{`:root { --brand: ${brandColor}; }`}</style>

      <div className="min-h-screen" style={{ fontFamily: 'Inter, sans-serif' }}>
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
                <h1 className="text-2xl font-bold">{tenant.name}</h1>
                {tenant.tagline && (
                  <p className="mt-0.5 text-white/80 text-sm">{tenant.tagline}</p>
                )}
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
        <main className="mx-auto max-w-5xl px-4 py-10">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900">Available rooms</h2>
            <p className="mt-1 text-sm text-gray-500">
              Choose a room type to start your booking. All prices are in Ghana Cedis (GH₵).
            </p>
          </div>

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
        </main>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <footer className="border-t border-gray-100 bg-white py-8 mt-12">
          <div className="mx-auto max-w-5xl px-4 text-center text-xs text-gray-400">
            <p>{tenant.name} · Powered by <span className="font-semibold">AbrempongHMS</span></p>
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
