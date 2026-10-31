import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { searchListings } from '@/lib/directory'
import { photosFirst, townsWithListings } from '@/lib/listing-display'
import { townSearchHref } from '@/lib/marketplace-search'
import { EXPLORE_PHOTOS, townPhoto } from '@/lib/explore-media'
import { MarketplaceNav } from '@/components/marketplace/marketplace-nav'
import { MarketplaceFooter } from '@/components/marketplace/marketplace-footer'
import { ConceptSearch } from '@/components/marketplace/concepts/concept-search'
import {
  ConceptListingCard, DestinationTiles, KindsCompact, KindsEditorial,
  OwnersBand, PhotoCredits, TownLinks, WhyBeddilo, type Counts,
} from '@/components/marketplace/concepts/concept-sections'

/**
 * Homepage design concepts for review (local design branch only, never
 * deployed): /browse/concepts/a and /browse/concepts/b. Same data as the
 * live homepage — every listing, count and town is real.
 */

export const metadata: Metadata = { title: 'Homepage concept', robots: { index: false, follow: false } }

export default async function ConceptPage({ params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params
  if (variant !== 'a' && variant !== 'b') notFound()

  const [hostels, hotels, apartments] = await Promise.all([
    searchListings({ businessType: 'hostel', limit: 200, sort: 'newest' }),
    searchListings({ businessType: 'hotel', limit: 1 }),
    searchListings({ businessType: 'apartment', limit: 1 }),
  ])
  const counts: Counts = { hostel: hostels.total, hotel: hotels.total, apartment: apartments.total }
  const featured = photosFirst(hostels.listings).slice(0, 8)
  const towns = townsWithListings(hostels.listings)
  const townNames = towns.map((t) => t.town)

  const listings = (
    <section aria-labelledby="stays-heading" className="mx-auto max-w-6xl px-5 pt-14 sm:px-6 sm:pt-20">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="stays-heading" className="font-display text-[24px] font-bold tracking-[-0.015em] sm:text-[30px]">
            Student hostels on Beddilo
          </h2>
          <p className="mt-1 text-[15px] text-bd-slate">
            {hostels.total} {hostels.total === 1 ? 'hostel' : 'hostels'} in {towns.length} {towns.length === 1 ? 'town' : 'towns'}, newest first
          </p>
        </div>
        <Link href="/browse" className="bd-focus hidden shrink-0 items-center gap-1.5 rounded text-[15px] font-semibold text-bd-teal hover:underline hover:underline-offset-4 sm:inline-flex">
          See all <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      {variant === 'b' && towns.length > 1 && (
        <nav aria-label="Hostels by town" className="mt-5 flex flex-wrap gap-2">
          {towns.map((t) => (
            <Link
              key={t.town}
              href={townSearchHref(t.town, 'hostel')}
              className="bd-focus inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-bd-ink/15 bg-white px-4 text-[14px] font-medium text-bd-ink transition-colors hover:border-bd-ink/40"
            >
              {t.town} <span className="text-bd-slate">{t.count}</span>
            </Link>
          ))}
        </nav>
      )}
      <ul className="mt-6 grid gap-x-5 gap-y-5 sm:grid-cols-2 sm:gap-y-9 lg:grid-cols-4">
        {featured.map((l) => (
          <li key={l.slug} className="border-b border-bd-ink/10 pb-5 last:border-0 sm:border-0 sm:pb-0">
            <ConceptListingCard listing={l} />
          </li>
        ))}
      </ul>
      <Link
        href="/browse"
        className="bd-focus mt-6 flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-bd-ink/20 text-[15px] font-semibold text-bd-ink sm:hidden"
      >
        See all {hostels.total} hostels <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  )

  const why = (
    <section aria-labelledby="why-heading" className="mx-auto max-w-6xl px-5 pt-16 sm:px-6 sm:pt-24">
      <h2 id="why-heading" className="font-display text-[24px] font-bold tracking-[-0.015em] sm:text-[30px]">Why book with Beddilo</h2>
      <WhyBeddilo />
    </section>
  )

  const owners = (
    <section aria-labelledby="owners-heading" className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
      <OwnersBand />
    </section>
  )

  if (variant === 'a') {
    return (
      <div className="min-h-screen bg-white text-bd-ink antialiased">
        <MarketplaceNav />

        {/* ── A. Editorial: light hero, one-row search ─────────────── */}
        <section aria-labelledby="hero-heading" className="border-b border-bd-ink/10 bg-bd-ivory-50">
          <div className="mx-auto max-w-6xl px-5 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-16">
            <p className="text-[15px] font-semibold text-bd-teal">A world of stays</p>
            <h1 id="hero-heading" className="mt-2 max-w-3xl font-display text-[32px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[46px]">
              Find a place to stay in Ghana
            </h1>
            <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-bd-slate sm:text-[18px]">
              Student hostels near campus, hotels and apartments. Compare rooms and
              prices, then book directly with the property.
            </p>
            <div className="mt-7 max-w-4xl">
              <ConceptSearch layout="bar" destinations={townNames} />
            </div>
            {towns.length > 0 && (
              <nav aria-label="Popular towns" className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
                <span className="text-bd-slate">Popular:</span>
                {towns.slice(0, 6).map((t) => (
                  <Link key={t.town} href={townSearchHref(t.town, 'hostel')} className="bd-focus rounded font-medium text-bd-ink underline decoration-bd-ink/25 underline-offset-4 hover:decoration-bd-ink">
                    {t.town}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </section>

        <section aria-labelledby="kinds-heading" className="mx-auto max-w-6xl px-5 pt-14 sm:px-6 sm:pt-20">
          <h2 id="kinds-heading" className="font-display text-[24px] font-bold tracking-[-0.015em] sm:text-[30px]">
            Explore your kind of stay
          </h2>
          <KindsEditorial counts={counts} />
        </section>

        {listings}

        <section aria-labelledby="towns-heading" className="mx-auto max-w-6xl px-5 pt-16 sm:px-6 sm:pt-24">
          <h2 id="towns-heading" className="font-display text-[24px] font-bold tracking-[-0.015em] sm:text-[30px]">
            Hostels by town
          </h2>
          <TownLinks towns={towns} />
        </section>

        {why}
        {owners}

        <div className="mx-auto max-w-6xl px-5 pb-10 sm:px-6">
          <PhotoCredits photos={[EXPLORE_PHOTOS.legon, EXPLORE_PHOTOS.labadi, EXPLORE_PHOTOS.accra]} />
        </div>
        <MarketplaceFooter />
      </div>
    )
  }

  const destinationPhotos = towns.slice(0, 4).map((t) => townPhoto(t.town)).filter((p) => p !== null)

  return (
    <div className="min-h-screen bg-white text-bd-ink antialiased">
      <MarketplaceNav />

      {/* ── B. Split hero: text and search beside a place photo ─────── */}
      <section aria-labelledby="hero-heading" className="bg-bd-ivory-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 pb-10 pt-6 sm:px-6 sm:pb-14 sm:pt-12 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-12 lg:pb-16 lg:pt-14">
          <figure className="relative order-first overflow-hidden rounded-2xl lg:order-last">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={EXPLORE_PHOTOS.legon.src}
              alt={EXPLORE_PHOTOS.legon.alt}
              className="aspect-[16/9] w-full object-cover lg:aspect-[5/6]"
            />
            <figcaption className="absolute bottom-3 left-3 rounded-md bg-white/90 px-2.5 py-1 text-[12px] font-medium text-bd-ink">
              {EXPLORE_PHOTOS.legon.place}
            </figcaption>
          </figure>
          <div>
            <p className="text-[15px] font-semibold text-bd-teal">A world of stays</p>
            <h1 id="hero-heading" className="mt-2 font-display text-[32px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[46px]">
              Find a place to stay in Ghana
            </h1>
            <p className="mt-3 text-[17px] leading-relaxed text-bd-slate sm:text-[18px]">
              Student hostels near campus, hotels and apartments. Compare rooms and
              prices, then book directly with the property.
            </p>
            <div className="mt-7">
              <ConceptSearch layout="stacked" destinations={townNames} />
            </div>
          </div>
        </div>
      </section>

      {listings}

      <section aria-labelledby="destinations-heading" className="mx-auto max-w-6xl px-5 pt-16 sm:px-6 sm:pt-24">
        <h2 id="destinations-heading" className="font-display text-[24px] font-bold tracking-[-0.015em] sm:text-[30px]">
          Popular destinations
        </h2>
        <DestinationTiles towns={towns} />
      </section>

      <section aria-labelledby="kinds-heading" className="mx-auto max-w-6xl px-5 pt-16 sm:px-6 sm:pt-24">
        <h2 id="kinds-heading" className="font-display text-[24px] font-bold tracking-[-0.015em] sm:text-[30px]">
          Explore your kind of stay
        </h2>
        <KindsCompact counts={counts} />
      </section>

      {why}
      {owners}

      <div className="mx-auto max-w-6xl px-5 pb-10 sm:px-6">
        <PhotoCredits photos={[EXPLORE_PHOTOS.legon, ...destinationPhotos, EXPLORE_PHOTOS.labadi, EXPLORE_PHOTOS.accra].filter((p, i, a) => a.indexOf(p) === i)} />
      </div>
      <MarketplaceFooter />
    </div>
  )
}
