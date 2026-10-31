import Link from 'next/link'
import type { DirectoryListing } from '@/lib/directory'
import { displayName, listingLocation, stayTypeLabel } from '@/lib/listing-display'
import { ListingCover, ListingPhoto } from '@/components/public/listing-photo'
import { Price } from '@/components/public/price'

/**
 * Grid-style listing card — the homepage's listings and the /browse grid
 * view, for every vertical. Photo-first with the details underneath, the
 * way people scan stays elsewhere; `rowOnPhone` turns it into a compact
 * row with a square thumbnail below the sm breakpoint, so a phone shows
 * several listings per screen. A property with no photos gets a plain
 * cover in the same box, so rows stay even. Shows only data we actually
 * have: no ratings or review counts (no reviews system exists), no "deal"
 * badges. The price always carries its billing unit.
 */
export function ListingCard({ listing, rowOnPhone = false }: { listing: DirectoryListing; rowOnPhone?: boolean }) {
  const name = displayName(listing.name)
  const location = listingLocation(listing.address_city, listing.address_region)
  const details = [
    stayTypeLabel(listing.business_type, listing.accommodation_type),
    `${listing.category_count} room type${listing.category_count === 1 ? '' : 's'}`,
  ].join(' · ')

  return (
    <Link
      href={`/listing/${listing.slug}`}
      className={`bd-focus group flex h-full rounded-xl ${rowOnPhone ? 'gap-4 sm:flex-col sm:gap-0' : 'flex-col'}`}
    >
      <div
        className={`relative shrink-0 overflow-hidden bg-bd-mist ${
          rowOnPhone ? 'aspect-square w-24 rounded-lg sm:aspect-[3/2] sm:w-full sm:rounded-xl' : 'aspect-[3/2] w-full rounded-xl'
        }`}
      >
        {listing.hero_image_url ? (
          <ListingPhoto
            src={listing.hero_image_url}
            alt={`${name}, ${location || 'property photo'}`}
            name={name}
            sizes={rowOnPhone ? '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 96px' : '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw'}
          />
        ) : (
          <ListingCover name={name} />
        )}
      </div>

      <div className={`flex min-w-0 flex-1 flex-col ${rowOnPhone ? 'sm:mt-3' : 'mt-3'}`}>
        <h3 className="line-clamp-1 text-[16px] font-semibold text-bd-ink group-hover:underline group-hover:underline-offset-2">
          {name}
        </h3>
        {location && <p className="truncate text-[14px] text-bd-slate">{location}</p>}
        <p className="text-[14px] text-bd-slate">{details}</p>
        <Price amount={listing.from_rate} unit={listing.from_rate_unit} from className="mt-auto pt-2" />
      </div>
    </Link>
  )
}
