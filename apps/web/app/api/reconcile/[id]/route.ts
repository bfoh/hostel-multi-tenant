import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getServerTenantId } from '@/lib/auth/tenant'
import { updateStatementStatus } from '@/lib/data/reconciliation'

const schema = z.object({
  status: z.enum(['matched', 'excluded', 'manual', 'unmatched']),
  notes:  z.string().max(500).optional().nullable(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const { id } = await params
  const body   = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  await updateStatementStatus(id, parsed.data.status, parsed.data.notes ?? undefined)
  return NextResponse.json({ ok: true })
}
