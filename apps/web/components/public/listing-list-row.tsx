import Link from 'next/link'
import { MapPin, ArrowRight } from 'lucide-react'
import { formatGHSPrice, rateUnitLabel } from '@/lib/utils'
import type { DirectoryListing } from '@/lib/directory'
import { ListingPhoto } from '@/components/public/listing-photo'

/**
 * Horizontal list-row card for the /browse search results page (photo
 * left, details middle, price right), adapted to real data only (no
 * ratings/reviews system exists). Shared by all verticals; the price
 * always carries its billing unit.
 */
export function ListingListRow({ listing }: { listing: DirectoryListing }) {
  const location = [listing.address_city, listing.address_region].filter(Boolean).join(', ')
  const unit = rateUnitLabel(listing.from_rate_unit)

  return (
    <Link
      href={`/listing/${listing.slug}`}
      className="bd-focus group flex flex-col overflow-hidden rounded-2xl border border-bd-teal/10 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-bd-teal/20 hover:shadow-[0_16px_32px_-16px_rgba(23,59,66,0.28)] motion-reduce:hover:translate-y-0 sm:flex-row"
    >
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-bd-ivory-200 sm:aspect-auto sm:h-auto sm:min-h-[168px] sm:w-60">
        <ListingPhoto src={listing.hero_image_url} alt={listing.name} businessType={listing.business_type} />
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[17px] font-semibold text-bd-teal group-hover:underline group-hover:underline-offset-4">
            {listing.name}
          </h3>
          {location && (
            <p className="mt-1 flex items-center gap-1 text-[13px] text-bd-slate">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {location}
            </p>
          )}
          <p className="mt-2 text-[13px] text-bd-slate">
            {listing.category_count} room type{listing.category_count === 1 ? '' : 's'}
          </p>
          {listing.tagline && (
            <p className="mt-1 line-clamp-1 text-[13px] text-bd-slate">{listing.tagline}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-row items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-2">
          <p className="leading-tight sm:text-right">
            <span className="block text-[12px] text-bd-slate">From</span>
            <span className="font-display text-[20px] font-bold text-bd-teal">{formatGHSPrice(listing.from_rate)}</span>
            {unit && <span className="ml-1 text-[13px] text-bd-slate sm:ml-0 sm:block">{unit}</span>}
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-bd-teal px-4 py-2 text-[13px] font-semibold text-bd-ivory transition-colors group-hover:bg-bd-teal-900">
            See rooms <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  )
}
