import Link from 'next/link'
import { MapPin, ArrowRight } from 'lucide-react'
import type { DirectoryListing } from '@/lib/directory'
import { stayTypeLabel } from '@/lib/listing-display'
import { ListingPhoto, NoPhotoTile } from '@/components/public/listing-photo'
import { Price } from '@/components/public/price'

/**
 * Horizontal result row for /browse: thumbnail left, details right, price
 * and action at the bottom. The thumbnail slot is the same size with or
 * without a photo, so rows stay even and a missing photo never takes over
 * the row. Real data only (no ratings/reviews system exists); the price
 * always carries its billing unit.
 */
export function ListingListRow({ listing }: { listing: DirectoryListing }) {
  const location = [listing.address_city, listing.address_region].filter(Boolean).join(', ')
  const details = [
    stayTypeLabel(listing.business_type, listing.accommodation_type),
    `${listing.category_count} room type${listing.category_count === 1 ? '' : 's'}`,
  ].join(' · ')

  return (
    <Link
      href={`/listing/${listing.slug}`}
      className="bd-focus group flex gap-3 overflow-hidden rounded-2xl border border-bd-teal/10 bg-white p-3 transition-[border-color,box-shadow] duration-200 hover:border-bd-teal/25 hover:shadow-[0_14px_28px_-18px_rgba(23,59,66,0.35)] sm:gap-5 sm:p-4"
    >
      {listing.hero_image_url ? (
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-bd-ivory-200 sm:h-36 sm:w-48">
          <ListingPhoto
            src={listing.hero_image_url}
            alt={`${listing.name}, ${location || 'property photo'}`}
            name={listing.name}
            sizes="(min-width: 640px) 192px, 96px"
          />
        </div>
      ) : (
        <NoPhotoTile name={listing.name} className="h-24 w-24 sm:h-36 sm:w-48" />
      )}

      <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:gap-6">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-display text-[16px] font-semibold leading-snug text-bd-teal group-hover:underline group-hover:underline-offset-4 sm:text-[17px]">
            {listing.name}
          </h3>
          {location && (
            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-bd-slate">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{location}</span>
            </p>
          )}
          <p className="mt-1 text-[13px] text-bd-slate">{details}</p>
          {listing.tagline && (
            <p className="mt-1 hidden text-[13px] text-bd-slate sm:line-clamp-2">{listing.tagline}</p>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-1 pt-2 sm:mt-0 sm:flex-col sm:items-end sm:justify-center sm:pt-0">
          <Price amount={listing.from_rate} unit={listing.from_rate_unit} from className="sm:text-right" />
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-bd-teal sm:mt-2 sm:rounded-full sm:bg-bd-teal sm:px-4 sm:py-2 sm:text-bd-ivory sm:group-hover:bg-bd-teal-900">
            View property <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  )
}
