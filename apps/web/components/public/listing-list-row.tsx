import Link from 'next/link'
import { ChevronRight, MapPin } from 'lucide-react'
import type { DirectoryListing } from '@/lib/directory'
import { displayName, listingLocation, stayTypeLabel } from '@/lib/listing-display'
import { ListingCover, ListingPhoto } from '@/components/public/listing-photo'
import { Price } from '@/components/public/price'

/**
 * Horizontal result row for /browse, separated from its neighbours by a
 * divider rather than a box: picture left, details in the middle, price
 * and action on the right (under the details on phones). The picture
 * slot is the same size with or without a photo, so rows stay even. Real
 * data only (no ratings/reviews system exists); the price always carries
 * its billing unit.
 */
export function ListingListRow({ listing }: { listing: DirectoryListing }) {
  const name = displayName(listing.name)
  const location = listingLocation(listing.address_city, listing.address_region)
  const details = [
    stayTypeLabel(listing.business_type, listing.accommodation_type),
    `${listing.category_count} room type${listing.category_count === 1 ? '' : 's'}`,
  ].join(' · ')

  return (
    <Link
      href={`/listing/${listing.slug}`}
      className="bd-focus group flex gap-4 rounded-xl py-5 sm:gap-6"
    >
      <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-lg bg-bd-mist sm:aspect-[3/2] sm:w-60 sm:rounded-xl">
        {listing.hero_image_url ? (
          <ListingPhoto
            src={listing.hero_image_url}
            alt={`${name}, ${location || 'property photo'}`}
            name={name}
            sizes="(min-width: 640px) 240px, 96px"
          />
        ) : (
          <ListingCover name={name} note={false} />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col py-0.5 sm:flex-row sm:gap-6 sm:py-1">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[16px] font-semibold leading-snug text-bd-ink group-hover:underline group-hover:underline-offset-2 sm:text-[17px]">
            {name}
          </h3>
          {location && (
            <p className="mt-1 flex items-center gap-1 text-[14px] text-bd-slate">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{location}</span>
            </p>
          )}
          <p className="mt-1 text-[14px] text-bd-slate">{details}</p>
          {listing.tagline && (
            <p className="mt-2 hidden text-[14px] text-bd-ink/80 sm:line-clamp-2">{listing.tagline}</p>
          )}
          {!listing.hero_image_url && <p className="mt-2 hidden text-[13px] text-bd-slate sm:block">No photos yet</p>}
        </div>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-2 sm:mt-0 sm:w-44 sm:flex-col sm:items-end sm:justify-between sm:pt-0">
          <Price amount={listing.from_rate} unit={listing.from_rate_unit} from className="sm:text-right" />
          <span className="hidden items-center gap-1 text-[14px] font-semibold text-bd-teal group-hover:underline group-hover:underline-offset-4 sm:inline-flex">
            See rooms <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  )
}
