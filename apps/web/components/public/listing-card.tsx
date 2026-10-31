import Link from 'next/link'
import type { DirectoryListing } from '@/lib/directory'
import { displayName, listingLocation, stayTypeLabel } from '@/lib/listing-display'
import { ListingCover, ListingPhoto } from '@/components/public/listing-photo'
import { Price } from '@/components/public/price'

/**
 * Grid-style listing card — the homepage's featured section and the
 * /browse grid view, for every vertical. Photo-first with the details
 * underneath, the way people scan stays elsewhere; a property with no
 * photos gets a designed cover in the same box, so rows stay even. Shows
 * only data we actually have: no ratings or review counts (no reviews
 * system exists), no "deal" badges. The price always carries its billing
 * unit.
 */
export function ListingCard({ listing }: { listing: DirectoryListing }) {
  const name = displayName(listing.name)
  const location = listingLocation(listing.address_city, listing.address_region)
  const details = [
    stayTypeLabel(listing.business_type, listing.accommodation_type),
    `${listing.category_count} room type${listing.category_count === 1 ? '' : 's'}`,
  ].join(' · ')

  return (
    <Link href={`/listing/${listing.slug}`} className="bd-focus group block h-full rounded-xl">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-bd-mist">
        {listing.hero_image_url ? (
          <ListingPhoto
            src={listing.hero_image_url}
            alt={`${name}, ${location || 'property photo'}`}
            name={name}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 80vw"
          />
        ) : (
          <ListingCover name={name} colorKey={listing.slug} />
        )}
      </div>

      <div className="mt-3 space-y-0.5">
        <h3 className="line-clamp-1 text-[15px] font-semibold text-bd-ink group-hover:underline group-hover:underline-offset-2">
          {name}
        </h3>
        {location && <p className="truncate text-[14px] text-bd-slate">{location}</p>}
        <p className="text-[14px] text-bd-slate">{details}</p>
        <Price amount={listing.from_rate} unit={listing.from_rate_unit} from className="pt-1.5" />
      </div>
    </Link>
  )
}
