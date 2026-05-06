/**
 * Maintenance attachment validation + upload.
 *
 * Validates MIME by browser-reported `file.type`. Bucket-level
 * `allowed_mime_types` enforces a second check. Path scheme:
 *   <tenant_id>/<request_id>/<message_id>/<safe-filename>
 */

import { createAdminClient } from '@/lib/supabase/admin'

export const MAINTENANCE_BUCKET = 'maintenance-attachments'
export const MAX_BYTES_PER_FILE = 5 * 1024 * 1024
export const MAX_FILES_PER_MESSAGE = 5
export const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'image/heic', 'image/heif', 'image/heic-sequence',
  'application/pdf',
])

interface UploadArgs {
  files:     File[]
  tenantId:  string
  requestId: string
  messageId: string
}

export async function uploadAttachments(args: UploadArgs): Promise<{ paths: string[] } | { error: string }> {
  if (args.files.length > MAX_FILES_PER_MESSAGE) {
    return { error: `Max ${MAX_FILES_PER_MESSAGE} files per message` }
  }

  const admin = createAdminClient()
  const paths: string[] = []

  for (const file of args.files) {
    if (file.size > MAX_BYTES_PER_FILE) {
      return { error: `${file.name}: exceeds 5 MB` }
    }
    const mime = file.type
    if (!ALLOWED_MIME.has(mime)) {
      return { error: `${file.name}: unsupported type ${mime || 'unknown'}` }
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'file'
    const path     = `${args.tenantId}/${args.requestId}/${args.messageId}/${safeName}`
    const buf      = Buffer.from(await file.arrayBuffer())

    const { error } = await admin.storage.from(MAINTENANCE_BUCKET).upload(path, buf, {
      contentType: mime,
      upsert: false,
    })
    if (error) return { error: `Upload failed: ${error.message}` }
    paths.push(path)
  }

  return { paths }
}

export async function signedUrlFor(path: string, ttlSeconds = 600): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(MAINTENANCE_BUCKET).createSignedUrl(path, ttlSeconds)
  if (error || !data) return null
  return data.signedUrl
}
