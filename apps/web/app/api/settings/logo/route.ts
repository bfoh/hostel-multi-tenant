import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('logo') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Validate: image only, max 2 MB
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: 'Image must be under 2 MB' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${tenantId}/logo.${ext}`
  const bytes = await file.arrayBuffer()

  const supabase = await createClient()

  const { error: uploadError } = await supabase.storage
    .from('tenant-logos')
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('tenant-logos').getPublicUrl(path)

  // Bust the cache by appending a timestamp
  const logoUrl = `${publicUrl}?t=${Date.now()}`

  const { error: updateError } = await supabase
    .from('tenants')
    .update({ logo_url: logoUrl })
    .eq('id', tenantId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ logo_url: logoUrl })
}
