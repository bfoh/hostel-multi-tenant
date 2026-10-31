import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { MarketplaceVertical } from '@/lib/directory'
import { EXPLORE_PHOTOS, type ExplorePhoto } from '@/lib/explore-media'

/*
 * Homepage discovery: one card per kind of stay. The photos are of places
 * in Ghana, credited by <PhotoCredits> and never shown as a property; the
 * counts are the live number of listings in each vertical.
 */

const KINDS: Array<{ key: MarketplaceVertical; title: string; body: string; href: string; noun: [string, string]; photo: ExplorePhoto }> = [
  { key: 'hostel', title: 'Student hostels', body: 'Shared and private rooms near campus', href: '/browse', noun: ['hostel', 'hostels'], photo: EXPLORE_PHOTOS.legon },
  { key: 'hotel', title: 'Hotels & resorts', body: 'Rooms by the night, from the city to the coast', href: '/browse?type=hotel', noun: ['hotel', 'hotels'], photo: EXPLORE_PHOTOS.labadi },
  { key: 'apartment', title: 'Apartments', body: 'Serviced and short-let apartments', href: '/browse?type=apartment', noun: ['apartment', 'apartments'], photo: EXPLORE_PHOTOS.accra },
]

/** The photos KindsOfStay shows, for the page's credit line. */
export const KINDS_PHOTOS = KINDS.map((k) => k.photo)

export function KindsOfStay({ counts }: { counts: Record<MarketplaceVertical, number> }) {
  return (
    // Phones: a swipeable row with the next card peeking in, so the three
    // photos don't push the listings a screen and a half down.
    <ul className="mp-no-scrollbar -mx-5 mt-6 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:mt-8 sm:scroll-px-6 sm:px-6 md:mx-0 md:grid md:grid-cols-3 md:gap-x-5 md:overflow-visible md:px-0">
      {KINDS.map((k) => {
        const n = counts[k.key]
        return (
          <li key={k.key} className="w-[78%] max-w-[340px] shrink-0 snap-start md:w-auto md:max-w-none">
            <Link href={k.href} className="bd-focus group block rounded-xl">
              <div className="aspect-[4/3] overflow-hidden rounded-xl bg-bd-mist">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={k.photo.src}
                  alt={k.photo.alt}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
                />
              </div>
              <h3 className="mt-3 flex items-center gap-1.5 text-[18px] font-semibold text-bd-ink">
                {k.title}
                <ArrowRight className="h-4 w-4 text-bd-teal transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
              </h3>
              <p className="mt-0.5 text-[15px] text-bd-slate">{k.body}</p>
              {n > 0 && <p className="mt-0.5 text-[14px] font-medium text-bd-ink">{n} {n === 1 ? k.noun[0] : k.noun[1]}</p>}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** Credit line for the illustrative place photos used on a page. */
export function PhotoCredits({ photos }: { photos: ExplorePhoto[] }) {
  return (
    <p className="text-[12px] leading-relaxed text-bd-slate">
      Photos show places in Ghana, not listed properties.{' '}
      {photos.map((p, i) => (
        <span key={p.src}>
          {p.place}: <a href={p.sourceUrl} className="underline underline-offset-2 hover:text-bd-ink">{p.author}</a>,{' '}
          <a href={p.licenseUrl} className="underline underline-offset-2 hover:text-bd-ink">{p.license}</a>
          {i < photos.length - 1 ? '; ' : '.'}
        </span>
      ))}
    </p>
  )
}
