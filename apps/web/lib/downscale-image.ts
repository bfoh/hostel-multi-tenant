/**
 * Browser-side resize for listing photos before upload: phone cameras
 * produce 3–12 MB files, far more than a listing ever displays. Re-encodes
 * to a JPEG no larger than `maxEdge` on its longest side, which also drops
 * EXIF metadata such as the GPS location. Returns null when the browser
 * can't decode the file (e.g. HEIC outside Safari), so the caller can ask
 * for a JPEG, PNG or WebP instead.
 */
export async function downscaleImage(file: File, maxEdge = 1600, quality = 0.82): Promise<Blob | null> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return null
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  // JPEG has no transparency: put PNG cut-outs on white, not black.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality))
}
