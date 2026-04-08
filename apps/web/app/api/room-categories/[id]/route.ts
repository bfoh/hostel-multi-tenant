import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  name:        z.string().min(2).max(100).optional(),
  type:        z.enum(['single', 'double', 'twin', 'triple', 'quad', 'dormitory', 'suite', 'studio']).optional(),
  base_rate:   z.number().int().min(1).optional(),
  rate_unit:   z.enum(['night', 'week', 'month', 'semester']).optional(),
  capacity:    z.number().int().min(1).max(20).optional(),
  description: z.string().max(500).nullable().optional(),
  amenities:   z.array(z.string()).optional(),
  is_active:   z.boolean().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('room_categories')
    .update(parsed.data)
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
