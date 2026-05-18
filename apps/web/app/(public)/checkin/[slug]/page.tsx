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

  // Categories with at least one available room
  const { data: cats } = await admin
    .from('room_categories')
    .select('id, name, description, base_rate, rate_unit, rooms(id, status)')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('base_rate', { ascending: true })

  const categories = (cats ?? [])
    .map((c) => {
      const rooms = Array.isArray(c.rooms) ? c.rooms : []
      const available = rooms.filter((r: { status: string }) => r.status === 'available').length
      return {
        id:          c.id,
        name:        c.name,
        description: c.description as string | null,
        base_rate:   c.base_rate as number,
        rate_unit:   c.rate_unit as string,
        available,
      }
    })
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
