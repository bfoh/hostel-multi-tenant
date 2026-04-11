import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  decision:    z.enum(['approved', 'rejected', 'needs_resubmission']),
  document_id: z.string().uuid().optional(),
  notes:       z.string().max(500).optional(),
})

// POST /api/id-verification/[occupantId] — submit a verification decision
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ occupantId: string }> }
) {
  const { occupantId } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const isApproved = parsed.data.decision === 'approved'

  // Update occupant
  const occupantUpdate: Record<string, unknown> = {
    id_verified:       isApproved,
    id_rejection_notes: isApproved ? null : (parsed.data.notes ?? null),
  }
  if (isApproved) {
    occupantUpdate.id_verified_at = new Date().toISOString()
    occupantUpdate.id_verified_by = user?.id
  }

  const { error: updateError } = await (supabase.from('occupants') as any)
    .update(occupantUpdate)
    .eq('id', occupantId)
    .eq('tenant_id', tenantId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Log the review decision
  const { data, error } = await (supabase.from('id_verification_reviews') as any)
    .insert({
      tenant_id:   tenantId,
      occupant_id: occupantId,
      document_id: parsed.data.document_id,
      decision:    parsed.data.decision,
      notes:       parsed.data.notes,
      reviewed_by: user?.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
