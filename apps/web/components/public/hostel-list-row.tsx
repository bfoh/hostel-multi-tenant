import Link from 'next/link'
import { MapPin, Heart, Building2, ArrowRight } from 'lucide-react'
import { formatGHS } from '@/lib/utils'
import type { DirectoryHostel } from '@/lib/directory'
import { MP } from '@/lib/marketplace-theme'

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
      className="group flex flex-col overflow-hidden rounded-xl bg-white transition-shadow hover:shadow-md sm:flex-row"
      style={{ border: `1px solid ${MP.border}` }}
    >
      <div className="relative h-48 w-full shrink-0 overflow-hidden sm:h-auto sm:w-56" style={{ background: MP.surfaceSoft }}>
        {hostel.hero_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hostel.hero_image_url}
            alt={hostel.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Building2 className="h-10 w-10" style={{ color: MP.goldDeep, opacity: 0.35 }} />
          </div>
        )}
        <span className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm">
          <Heart className="h-4 w-4" style={{ color: MP.textSecondary }} />
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-bold group-hover:underline" style={{ color: MP.green }}>{hostel.name}</h3>
          {location && (
            <p className="mt-1 flex items-center gap-1 text-[13px]" style={{ color: MP.textSecondary }}>
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {location}
            </p>
          )}
          <p className="mt-2 text-[13px]" style={{ color: MP.textSecondary }}>
            {hostel.category_count} room type{hostel.category_count === 1 ? '' : 's'} available
          </p>
          {hostel.tagline && (
            <p className="mt-1 line-clamp-1 text-[13px]" style={{ color: MP.textSecondary }}>{hostel.tagline}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-row items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-1.5">
          <div className="text-right">
            <p className="text-[11px]" style={{ color: MP.textSecondary, opacity: 0.8 }}>Starting from</p>
            <p className="text-[20px] font-bold" style={{ color: MP.ink }}>{formatGHS(hostel.from_rate)}</p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-colors"
            style={{ background: MP.green }}
          >
            See rooms <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
