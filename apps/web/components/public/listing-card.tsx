import Link from 'next/link'
import { MapPin, ArrowRight } from 'lucide-react'
import { formatGHSPrice, rateUnitLabel } from '@/lib/utils'
import type { DirectoryListing } from '@/lib/directory'
import { ListingPhoto } from '@/components/public/listing-photo'

/**
 * Grid-style listing card — the "discovery" card used on the homepage's
 * featured section and the /browse grid view, for either vertical.
 * Photo-first, name/location, price bottom — adapted to only show data we
 * actually have: no star ratings or review counts (no reviews system
 * exists), no fabricated "deal" badges, and the hero photo is a real
 * owner-uploaded photo or a neutral placeholder. The price always carries
 * its billing unit (night/week/month/semester) from the room type it
 * comes from.
 */
export function ListingCard({ listing }: { listing: DirectoryListing }) {
  const location = [listing.address_city, listing.address_region].filter(Boolean).join(', ')
  const unit = rateUnitLabel(listing.from_rate_unit)

  return (
    <Link
      href={`/listing/${listing.slug}`}
      className="bd-focus group flex h-full flex-col overflow-hidden rounded-2xl border border-bd-teal/10 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-bd-teal/20 hover:shadow-[0_16px_32px_-16px_rgba(23,59,66,0.28)] motion-reduce:hover:translate-y-0"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-bd-ivory-200">
        <ListingPhoto src={listing.hero_image_url} alt={listing.name} businessType={listing.business_type} />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate font-display text-[16px] font-semibold text-bd-teal">{listing.name}</h3>
        {location && (
          <p className="mt-1 flex items-center gap-1 text-[13px] text-bd-slate">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{location}</span>
          </p>
        )}
        <p className="mt-1 text-[13px] text-bd-slate">
          {listing.category_count} room type{listing.category_count === 1 ? '' : 's'}
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <p className="leading-tight">
            <span className="block text-[12px] text-bd-slate">From</span>
            <span className="font-display text-[18px] font-bold text-bd-teal">{formatGHSPrice(listing.from_rate)}</span>
            {unit && <span className="ml-1 text-[13px] text-bd-slate">{unit}</span>}
          </p>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bd-amber text-bd-teal transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          >
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}
