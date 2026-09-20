import Link from 'next/link'
import { MapPin, Heart, Building2, ArrowRight } from 'lucide-react'
import { formatGHS } from '@/lib/utils'
import type { DirectoryHostel } from '@/lib/directory'

/**
 * Horizontal list-row card for the /hostels search results page — modeled
 * on Booking.com's search-results row (photo left, details middle, price
 * right), adapted to real data only (no ratings/reviews system exists).
 */
export function HostelListRow({ hostel }: { hostel: DirectoryHostel }) {
  const location = [hostel.address_city, hostel.address_region].filter(Boolean).join(', ')

  return (
    <Link
      href={`/hostels/${hostel.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md sm:flex-row"
    >
      <div className="relative h-48 w-full shrink-0 overflow-hidden bg-neutral-100 sm:h-auto sm:w-56">
        {hostel.hero_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hostel.hero_image_url}
            alt={hostel.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Building2 className="h-10 w-10 text-neutral-300" />
          </div>
        )}
        <span className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm">
          <Heart className="h-4 w-4 text-neutral-500" />
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-bold text-[#003580] group-hover:underline">{hostel.name}</h3>
          {location && (
            <p className="mt-1 flex items-center gap-1 text-[13px] text-neutral-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {location}
            </p>
          )}
          <p className="mt-2 text-[13px] text-neutral-600">
            {hostel.category_count} room type{hostel.category_count === 1 ? '' : 's'} available
          </p>
          {hostel.tagline && (
            <p className="mt-1 line-clamp-1 text-[13px] text-neutral-500">{hostel.tagline}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-row items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-1.5">
          <div className="text-right">
            <p className="text-[11px] text-neutral-400">Starting from</p>
            <p className="text-[20px] font-bold text-neutral-900">{formatGHS(hostel.from_rate)}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#0071c2] px-4 py-2 text-[13px] font-semibold text-white transition-colors group-hover:bg-[#00487a]">
            See rooms <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
