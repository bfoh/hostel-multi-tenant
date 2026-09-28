import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { requireTenantRole } from '@/lib/auth/tenant-role'

const schema = z.object({
  status:   z.enum(['approved', 'rejected']).optional(),
  featured: z.boolean().optional(),
}).refine((d) => d.status !== undefined || d.featured !== undefined, {
  message: 'Provide status and/or featured',
})

/**
 * PATCH /api/reports/feedback/[id] — staff moderation of a guest review
 * (occupant_feedback), gating what surfaces on the public listing page's
 * testimonials section (status='approved' AND featured=true).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleCtx = await requireTenantRole(tenantId, ['owner', 'manager'])
  if (roleCtx instanceof NextResponse) return roleCtx

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const supabase = await createTenantAdminClientFromHeaders()

  const { data: updated, error } = await supabase
    .from('occupant_feedback')
    .update({
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.featured !== undefined ? { featured: parsed.data.featured } : {}),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  await (supabase.from('audit_log') as any).insert({
    tenant_id:   tenantId,
    action:      'feedback.moderated',
    entity_type: 'occupant_feedback',
    entity_id:   id,
    new_values:  parsed.data,
  }).throwOnError().then(() => {}).catch(() => {})

  return NextResponse.json({ ok: true })
}
