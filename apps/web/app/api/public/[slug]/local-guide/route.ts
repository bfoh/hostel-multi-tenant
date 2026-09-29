import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Public, unauthenticated read — the guest portal's "Local Guide" tab.
 * Uses the admin client (not the RLS-bound createClient()) since an
 * anonymous guest has no tenant_members row to satisfy the manage policy
 * on tenant_local_guide_entries.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data } = await supabase
    .from('tenant_local_guide_entries')
    .select('id, category, name, note, distance, link')
    .eq('tenant_id', tenant.id)
    .order('sort_order')
    .order('created_at')
    .limit(100)

  return NextResponse.json(data ?? [])
}
