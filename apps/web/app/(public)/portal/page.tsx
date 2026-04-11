import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { OccupantPortal } from '@/components/public/occupant-portal'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  if (!tenant) return { title: 'My Booking' }
  return { title: `My Booking — ${tenant.name}` }
}

async function getTenant() {
  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id')
  if (!tenantId) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('tenants')
    .select('id, slug, name, logo_url, primary_color, contact_phone')
    .eq('id', tenantId)
    .single()

  return data as {
    id: string; slug: string; name: string
    logo_url: string | null; primary_color: string | null; contact_phone: string | null
  } | null
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ pay?: string }>
}) {
  const tenant = await getTenant()
  if (!tenant) notFound()

  const { pay } = await searchParams

  return (
    <OccupantPortal
      tenant={{
        slug:       tenant.slug,
        name:       tenant.name,
        logoUrl:    tenant.logo_url,
        brandColor: tenant.primary_color ?? '#2563EB',
        phone:      tenant.contact_phone,
      }}
      payStatus={pay as 'success' | 'failed' | 'error' | undefined}
    />
  )
}
