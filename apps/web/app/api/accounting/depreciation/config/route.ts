import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface ConfigBody {
  asset_id:               string
  useful_life_months:     number | null
  salvage_value?:         number
  depreciation_start_date?: string | null
}

/**
 * POST /api/accounting/depreciation/config
 * Updates depreciation parameters on an asset. Send useful_life_months = null
 * to clear (asset becomes non-depreciable).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let body: ConfigBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })
  if (body.useful_life_months !== null && (!Number.isInteger(body.useful_life_months) || body.useful_life_months <= 0)) {
    return NextResponse.json({ error: 'useful_life_months must be > 0 or null' }, { status: 400 })
  }
  if (body.salvage_value !== undefined && (!Number.isInteger(body.salvage_value) || body.salvage_value < 0)) {
    return NextResponse.json({ error: 'salvage_value must be non-negative integer pesewas' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await (admin as any)
    .from('assets')
    .update({
      useful_life_months:      body.useful_life_months,
      ...(body.salvage_value !== undefined ? { salvage_value: body.salvage_value } : {}),
      ...(body.depreciation_start_date !== undefined ? { depreciation_start_date: body.depreciation_start_date } : {}),
    })
    .eq('id', body.asset_id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
