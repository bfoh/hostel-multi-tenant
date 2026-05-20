import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'

import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export const runtime = 'nodejs'

export async function POST() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const supabase = createAdminClient()
  const newSecret = randomUUID()

  const { error } = await (supabase.from('tenants') as any)
    .update({ enquiry_webhook_secret: newSecret })
    .eq('id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
