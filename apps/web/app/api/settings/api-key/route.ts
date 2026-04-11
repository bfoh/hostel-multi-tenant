import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServerTenantId } from '@/lib/auth/tenant'

function generateApiKey(): string {
  // ahms_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX  (32 hex chars = 128 bits)
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `ahms_live_${hex}`
}

/** POST — generate (or rotate) the public API key */
export async function POST() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const key      = generateApiKey()
  const supabase = await createClient()

  const { error } = await supabase
    .from('tenants')
    .update({ public_api_key: key })
    .eq('id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ key })
}

/** DELETE — revoke the API key */
export async function DELETE() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const supabase = await createClient()
  await supabase.from('tenants').update({ public_api_key: null }).eq('id', tenantId)

  return NextResponse.json({ ok: true })
}
