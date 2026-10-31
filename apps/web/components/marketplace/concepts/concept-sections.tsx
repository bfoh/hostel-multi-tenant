import Link from 'next/link'
import { ArrowRight, Check, HandCoins, CalendarCheck, KeyRound, Tag } from 'lucide-react'
import type { DirectoryListing } from '@/lib/directory'
import { displayName, listingInitials, listingLocation, stayTypeLabel } from '@/lib/listing-display'
import { townSearchHref } from '@/lib/marketplace-search'
import { EXPLORE_PHOTOS, townPhoto, type ExplorePhoto } from '@/lib/explore-media'
import { ListingPhoto } from '@/components/public/listing-photo'
import { Price } from '@/components/public/price'

/*
 * Design concept sections (not live) — shared by the two homepage concepts
 * rendered at /browse/concepts/[variant]. Real listing data only; the
 * photos in the discovery sections are of places, credited, and never
 * shown as a property.
 */

export type Town = { town: string; region: string | null; count: number }
export type Counts = { hostel: number; hotel: number; apartment: number }

/* ── Listing card: photo-first on desktop, a compact row on phones ── */

export function ConceptListingCard({ listing }: { listing: DirectoryListing }) {
  const name = displayName(listing.name)
  const location = listingLocation(listing.address_city, listing.address_region)
  const details = [
    stayTypeLabel(listing.business_type, listing.accommodation_type),
    `${listing.category_count} room type${listing.category_count === 1 ? '' : 's'}`,
  ].join(' · ')

  return (
    <Link
      href={`/listing/${listing.slug}`}
      className="bd-focus group flex h-full gap-4 rounded-xl sm:flex-col sm:gap-0"
    >
      <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-lg bg-bd-mist sm:aspect-[3/2] sm:w-full sm:rounded-xl">
        {listing.hero_image_url ? (
          <ListingPhoto
            src={listing.hero_image_url}
            alt={`${name}, ${location || 'property photo'}`}
            name={name}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 96px"
          />
        ) : (
          <NoPhoto name={name} />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col sm:mt-3">
        <h3 className="line-clamp-1 text-[16px] font-semibold text-bd-ink group-hover:underline group-hover:underline-offset-2">
          {name}
        </h3>
        {location && <p className="truncate text-[14px] text-bd-slate">{location}</p>}
        <p className="text-[14px] text-bd-slate">{details}</p>
        <Price amount={listing.from_rate} unit={listing.from_rate_unit} from className="mt-auto pt-2" />
      </div>
    </Link>
  )
}

/** Quiet stand-in for a listing without photos: initials and a plain note,
 *  on the same neutral ground as an image box, so a row of them stays calm. */
function NoPhoto({ name }: { name: string }) {
  return (
    <div role="img" aria-label={`${name}: no photos yet`} className="flex h-full w-full flex-col items-center justify-center gap-2 bg-bd-mist">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full border border-bd-ink/10 bg-white font-display text-[15px] font-semibold text-bd-teal sm:h-14 sm:w-14 sm:text-[18px]"
        aria-hidden="true"
      >
        {listingInitials(name)}
      </span>
      <span className="hidden text-[13px] text-bd-slate sm:block" aria-hidden="true">No photos yet</span>
    </div>
  )
}

/* ── Kinds of stay ──────────────────────────────────────────────── */

const KINDS: Array<{ key: keyof Counts; title: string; body: string; href: string; noun: [string, string]; photo: ExplorePhoto }> = [
  { key: 'hostel', title: 'Student hostels', body: 'Shared and private rooms near campus', href: '/browse', noun: ['hostel', 'hostels'], photo: EXPLORE_PHOTOS.legon },
  { key: 'hotel', title: 'Hotels & resorts', body: 'Rooms by the night, from the city to the coast', href: '/browse?type=hotel', noun: ['hotel', 'hotels'], photo: EXPLORE_PHOTOS.labadi },
  { key: 'apartment', title: 'Apartments', body: 'Serviced and short-let apartments', href: '/browse?type=apartment', noun: ['apartment', 'apartments'], photo: EXPLORE_PHOTOS.accra },
]

function countLabel(n: number, [one, many]: [string, string]) {
  return n > 0 ? `${n} ${n === 1 ? one : many}` : null
}

/** Large photo cards (concept A). */
export function KindsEditorial({ counts }: { counts: Counts }) {
  return (
    <ul className="mt-6 grid gap-x-5 gap-y-8 sm:mt-8 md:grid-cols-3">
      {KINDS.map((k) => {
        const count = countLabel(counts[k.key], k.noun)
        return (
          <li key={k.key}>
            <Link href={k.href} className="bd-focus group block rounded-xl">
              <div className="aspect-[16/10] overflow-hidden rounded-xl bg-bd-mist md:aspect-[4/3]">
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
              {count && <p className="mt-0.5 text-[14px] font-medium text-bd-ink">{count}</p>}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** Small thumbnail rows (concept B). */
export function KindsCompact({ counts }: { counts: Counts }) {
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-3">
      {KINDS.map((k) => {
        const count = countLabel(counts[k.key], k.noun)
        return (
          <li key={k.key}>
            <Link
              href={k.href}
              className="bd-focus group flex items-center gap-4 rounded-xl border border-bd-ink/10 bg-white p-2.5 pr-4 transition-colors hover:border-bd-ink/25"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={k.photo.src} alt="" loading="lazy" decoding="async" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold text-bd-ink">{k.title}</span>
                <span className="block truncate text-[14px] text-bd-slate">{count ?? k.body}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-bd-slate transition-transform group-hover:translate-x-0.5 group-hover:text-bd-teal motion-reduce:transition-none" aria-hidden="true" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/* ── Destinations ───────────────────────────────────────────────── */

/** Photo tiles for towns with listings (concept B). A town without a
 *  photo gets a plain teal tile rather than a borrowed picture. */
export function DestinationTiles({ towns }: { towns: Town[] }) {
  return (
    <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
      {towns.slice(0, 4).map((t) => {
        const photo = townPhoto(t.town)
        return (
          <li key={t.town}>
            <Link href={townSearchHref(t.town, 'hostel')} className="bd-focus group relative block aspect-[4/5] overflow-hidden rounded-xl bg-bd-teal">
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
                />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-4 pt-20 text-white">
                <span className="block font-display text-[20px] font-bold leading-tight sm:text-[22px]">{t.town}</span>
                <span className="mt-0.5 block text-[14px] text-white/85">
                  {t.count} {t.count === 1 ? 'hostel' : 'hostels'}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** Text list of towns with counts (concept A). */
export function TownLinks({ towns }: { towns: Town[] }) {
  return (
    <ul className="mt-5 grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:grid-cols-4">
      {towns.map((t) => (
        <li key={t.town} className="border-t border-bd-ink/10">
          <Link
            href={townSearchHref(t.town, 'hostel')}
            className="bd-focus group flex min-h-[56px] items-center justify-between gap-3 rounded py-3"
          >
            <span>
              <span className="block text-[16px] font-semibold text-bd-ink group-hover:underline group-hover:underline-offset-2">{t.town}</span>
              <span className="block text-[14px] text-bd-slate">{t.count} {t.count === 1 ? 'hostel' : 'hostels'}{t.region && t.region !== t.town ? ` · ${t.region}` : ''}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-bd-slate group-hover:text-bd-teal" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Credit line for the illustrative photos used on the page. */
export function PhotoCredits({ photos }: { photos: ExplorePhoto[] }) {
  return (
    <p className="mt-6 text-[12px] leading-relaxed text-bd-slate">
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

/* ── Trust and owners ───────────────────────────────────────────── */

const BENEFITS = [
  { icon: HandCoins, title: 'Book directly', body: 'You pay the property itself. Beddilo adds no booking commission to your rate.' },
  { icon: CalendarCheck, title: 'Live availability', body: 'Rooms and beds come straight from each property’s own booking system.' },
  { icon: KeyRound, title: 'Listed by the property', body: 'Every listing is run by the people who manage the property, not a reseller.' },
  { icon: Tag, title: 'Clear pricing', body: 'Prices show how they’re billed: per night, per month or per semester.' },
]

export function WhyBeddilo() {
  return (
    <ul className="mt-6 grid gap-x-8 gap-y-6 sm:mt-8 sm:grid-cols-2 lg:grid-cols-4">
      {BENEFITS.map((item) => (
        <li key={item.title} className="flex gap-4 sm:block">
          <item.icon className="h-6 w-6 shrink-0 text-bd-teal" strokeWidth={1.75} aria-hidden="true" />
          <div>
            <h3 className="text-[16px] font-semibold sm:mt-3">{item.title}</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-bd-slate">{item.body}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

const OWNER_POINTS = [
  'Free for 30 days, no card needed',
  'MoMo and card payments through Paystack',
  'Bookings, rooms and payments in one dashboard',
  'Your listing stays up after the trial',
]

export function OwnersBand() {
  return (
    <div className="grid gap-8 rounded-2xl bg-bd-teal p-6 text-white sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-14 lg:p-12">
      <div>
        <h2 id="owners-heading" className="font-display text-[26px] font-bold leading-tight tracking-[-0.015em] text-white sm:text-[32px]">
          Run a hostel, hotel or apartment?
        </h2>
        <p className="mt-3 max-w-lg text-[16px] leading-relaxed text-white/80">
          List it on Beddilo, take bookings online and manage rooms, residents and payments from one place.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/list-your-property"
            className="bd-focus-on-dark inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-bd-amber px-6 text-[15px] font-semibold text-bd-teal transition-colors hover:bg-bd-amber-300"
          >
            List your property <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/for-owners"
            className="bd-focus-on-dark inline-flex min-h-[48px] items-center justify-center rounded-lg border border-white/30 px-6 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
          >
            See how it works
          </Link>
        </div>
      </div>
      <ul className="grid gap-3.5">
        {OWNER_POINTS.map((point) => (
          <li key={point} className="flex gap-3 text-[15px] leading-snug text-white/90">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-bd-amber" strokeWidth={2.2} aria-hidden="true" />
            {point}
          </li>
        ))}
      </ul>
    </div>
  )
}
