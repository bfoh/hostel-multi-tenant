import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { id: occupantId } = await params
  const admin = createAdminClient()

  const { data } = await admin
    .from('occupant_documents')
    .select('*')
    .eq('occupant_id', occupantId)
    .order('created_at', { ascending: false })

  return NextResponse.json(data ?? [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const { id: occupantId } = await params

  // Expect multipart form: file + metadata fields
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const documentType = formData.get('document_type') as string ?? 'other'
  const notes = formData.get('notes') as string ?? null

  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })

  // Upload to Supabase Storage bucket: occupant-documents
  const ext = file.name.split('.').pop()
  const path = `${tenantId}/${occupantId}/${Date.now()}.${ext}`

  const admin = createAdminClient()

  const { data: upload, error: uploadErr } = await admin.storage
    .from('occupant-documents')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  // Get signed URL (1 year)
  const signedUrlResult = await admin.storage
    .from('occupant-documents')
    .createSignedUrl(path, 60 * 60 * 24 * 365)
  const signedUrl = signedUrlResult.data?.signedUrl

  // Save metadata to DB
  const { data, error } = await (admin.from('occupant_documents') as any)
    .insert({
      tenant_id:     tenantId,
      occupant_id:   occupantId,
      document_type: documentType,
      file_name:     file.name,
      file_url:      signedUrl ?? upload.path,
      file_size:     file.size,
      mime_type:     file.type,
      notes:         notes || null,
      uploaded_by:   user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
