import Link from 'next/link'
import { MapPin, ArrowRight } from 'lucide-react'
import type { DirectoryListing } from '@/lib/directory'
import { stayTypeLabel } from '@/lib/listing-display'
import { ListingPhoto, NoPhotoTile } from '@/components/public/listing-photo'
import { Price } from '@/components/public/price'

/**
 * Grid-style listing card — the homepage's featured section and the
 * /browse grid view, for every vertical. Shows only data we actually have:
 * no ratings or review counts (no reviews system exists), no "deal" badges.
 * A property with a photo leads with it; one without gets a compact
 * initials tile beside its name rather than an empty image-sized block.
 * The price always carries its billing unit.
 */
export function ListingCard({ listing }: { listing: DirectoryListing }) {
  const location = [listing.address_city, listing.address_region].filter(Boolean).join(', ')
  const details = [
    stayTypeLabel(listing.business_type, listing.accommodation_type),
    `${listing.category_count} room type${listing.category_count === 1 ? '' : 's'}`,
  ].join(' · ')

  return (
    <Link
      href={`/listing/${listing.slug}`}
      className="bd-focus group flex h-full flex-col overflow-hidden rounded-2xl border border-bd-teal/10 bg-white transition-[border-color,box-shadow] duration-200 hover:border-bd-teal/25 hover:shadow-[0_14px_28px_-18px_rgba(23,59,66,0.35)]"
    >
      {listing.hero_image_url && (
        <div className="relative aspect-[3/2] w-full overflow-hidden bg-bd-ivory-200">
          <ListingPhoto
            src={listing.hero_image_url}
            alt={`${listing.name}, ${location || 'property photo'}`}
            name={listing.name}
            sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 85vw"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-3">
          {!listing.hero_image_url && <NoPhotoTile name={listing.name} caption={null} className="h-12 w-12" />}
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 font-display text-[16px] font-semibold leading-snug text-bd-teal">{listing.name}</h3>
            {location && (
              <p className="mt-0.5 flex items-center gap-1 text-[13px] text-bd-slate">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{location}</span>
              </p>
            )}
          </div>
        </div>
        <p className="mt-2 text-[13px] text-bd-slate">{details}</p>
        {!listing.hero_image_url && <p className="mt-1 text-[12px] text-bd-slate">No photos yet</p>}

        <div className="mt-auto flex flex-col gap-3 pt-3">
          <Price amount={listing.from_rate} unit={listing.from_rate_unit} from />
          <span className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-bd-teal/15 text-[14px] font-semibold text-bd-teal transition-colors group-hover:border-bd-teal group-hover:bg-bd-teal group-hover:text-bd-ivory">
            View property <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  )
}
