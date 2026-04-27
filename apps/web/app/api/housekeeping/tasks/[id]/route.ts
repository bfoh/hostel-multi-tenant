import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const updateSchema = z.object({
  status:      z.enum(['pending', 'in_progress', 'done', 'skipped']).optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  notes:       z.string().max(500).optional().nullable(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body   = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const supabase = createAdminClient()
  const update: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.status === 'done') update.completed_at = new Date().toISOString()

  const { error } = await (supabase.from('housekeeping_tasks') as any)
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If done, mark room clean
  if (parsed.data.status === 'done') {
    const { data: task } = await supabase
      .from('housekeeping_tasks')
      .select('room_id')
      .eq('id', id)
      .single()
    if (task?.room_id) {
      await supabase
        .from('rooms')
        .update({ housekeeping_status: 'clean', last_cleaned_at: new Date().toISOString() })
        .eq('id', task.room_id)
    }
  }

  return NextResponse.json({ ok: true })
}
