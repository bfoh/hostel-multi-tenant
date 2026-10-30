import Link from 'next/link'
import { Camera, ChevronRight } from 'lucide-react'

/**
 * Photo checklist on the owner's Public Listing settings. Marketplace cards
 * and the listing gallery use the property photo plus each room type's
 * uploads, so this shows what guests currently see and links straight to
 * the room-type pages where photos are added.
 */
export function ListingPhotosCard({ hasPropertyPhoto, categories }: {
  hasPropertyPhoto: boolean
  categories: { id: string; name: string; photoCount: number }[]
}) {
  const roomPhotos = categories.reduce((n, c) => n + c.photoCount, 0)
  const total = roomPhotos + (hasPropertyPhoto ? 1 : 0)

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10">
          <Camera className="h-4 w-4 text-brand" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Listing photos</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            {total === 0
              ? 'Your listing has no photos yet, so guests see a plain placeholder instead.'
              : `Guests can see ${total} photo${total === 1 ? '' : 's'} on your listing.`}
            {' '}Listings with photos are shown first in the homepage&apos;s featured stays.
          </p>
        </div>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-xs text-text-secondary">
        <li>Use your own photos of the actual property: the building, each room type, bathrooms and shared spaces.</li>
        <li>Landscape photos taken in daylight work best. JPEG, PNG or WebP, up to 4 MB each and 12 per room type.</li>
      </ul>

      {categories.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/rooms/categories/${c.id}/edit`}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-surface-raised"
              >
                <span className="min-w-0 truncate text-text-primary">{c.name}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-text-secondary">
                  {c.photoCount === 0 ? 'Add photos' : `${c.photoCount} photo${c.photoCount === 1 ? '' : 's'}`}
                  <ChevronRight className="h-4 w-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-secondary">
          <Link href="/rooms/categories" className="font-medium text-brand hover:underline">Add a room type</Link> to start uploading photos.
        </p>
      )}
    </div>
  )
}
