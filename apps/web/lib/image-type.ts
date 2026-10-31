/**
 * The image types a property may upload as a listing photo, identified from
 * the file's first bytes rather than the browser-supplied Content-Type or
 * file name, which the caller controls. Matches the tenant-photos and
 * room-photos buckets' allowed types (migrations 121 and 127).
 */
export type ListingImageType = 'image/jpeg' | 'image/png' | 'image/webp'

export const LISTING_IMAGE_EXT: Record<ListingImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function sniffListingImage(bytes: Uint8Array): ListingImageType | null {
  const at = (i: number, sig: number[]) => sig.every((b, j) => bytes[i + j] === b)
  if (at(0, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp'
  return null
}
