import Link from 'next/link'
import { MapPin } from 'lucide-react'
import type { DirectoryListing } from '@/lib/directory'
import { displayName, listingLocation, stayTypeLabel } from '@/lib/listing-display'
import { ListingCover, ListingPhoto } from '@/components/public/listing-photo'
import { Price } from '@/components/public/price'

/**
 * Horizontal result row for /browse: picture left, details in the middle,
 * price and action on the right (under the details on phones). The picture
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
      className="bd-focus group flex gap-4 rounded-xl border border-bd-ink/10 bg-white p-3 transition-shadow duration-200 hover:shadow-[0_6px_20px_-8px_rgba(18,36,41,0.18)] sm:gap-5"
    >
      <div className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-lg bg-bd-mist sm:w-56">
        {listing.hero_image_url ? (
          <ListingPhoto
            src={listing.hero_image_url}
            alt={`${name}, ${location || 'property photo'}`}
            name={name}
            sizes="(min-width: 640px) 224px, 112px"
          />
        ) : (
          <ListingCover name={name} colorKey={listing.slug} note={false} />
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
          <span className="hidden min-h-[40px] items-center rounded-lg bg-bd-teal px-4 text-[14px] font-semibold text-white transition-colors group-hover:bg-bd-teal-900 sm:inline-flex">
            See rooms
          </span>
        </div>
      </div>
    </Link>
  )
}
