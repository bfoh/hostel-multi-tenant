import Link from 'next/link'
import { MapPin, Heart, Building2 } from 'lucide-react'
import { formatGHS } from '@/lib/utils'
import type { DirectoryHostel } from '@/lib/directory'

/**
 * Grid-style hostel card — the "discovery" card used on the homepage's
 * featured section and the /hostels grid view. Modeled on Booking.com's
 * property card (photo-first, name/location, price bottom-right), adapted
 * to only show data we actually have: no star ratings or review counts
 * (no reviews system exists), no fabricated "deal" badges — the hero photo
 * is a real owner-uploaded room photo when one exists.
 */
export function HostelCard({ hostel }: { hostel: DirectoryHostel }) {
  const location = [hostel.address_city, hostel.address_region].filter(Boolean).join(', ')

  return (
    <Link
      href={`/hostels/${hostel.slug}`}
      className="group block overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
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

      <div className="p-3.5">
        <h3 className="truncate text-[15px] font-bold text-neutral-900">{hostel.name}</h3>
        {location && (
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-neutral-500">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{location}</span>
          </p>
        )}
        <p className="mt-1.5 text-[12px] text-neutral-500">
          {hostel.category_count} room type{hostel.category_count === 1 ? '' : 's'} available
        </p>

        <div className="mt-3 flex items-end justify-between">
          <span className="text-[11px] text-neutral-400">Starting from</span>
          <span className="text-[16px] font-bold text-[#003580]">{formatGHS(hostel.from_rate)}</span>
        </div>
      </div>
    </Link>
  )
}
