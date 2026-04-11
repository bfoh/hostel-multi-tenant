import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// GET /api/id-verification — occupants with pending document review
// "Pending" = active occupants who have at least one document but id_verified = false
export async function GET() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('occupants')
    .select(`
      id, first_name, last_name, phone, email, photo_url,
      student_id, status, id_verified, id_verified_at, id_rejection_notes,
      occupant_documents(id, document_type, file_url, created_at)
    `)
    .eq('tenant_id', tenantId)
    .eq('id_verified', false)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Only return occupants who have uploaded at least one document
  const withDocs = (data ?? []).filter((o) => {
    const docs = Array.isArray(o.occupant_documents) ? o.occupant_documents : []
    return docs.length > 0
  })

  return NextResponse.json(withDocs)
}
