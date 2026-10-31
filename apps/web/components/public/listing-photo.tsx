'use client'

import { useEffect, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { coverTone, listingInitials } from '@/lib/listing-display'

/**
 * Listing photo with a fallback. Only ever shows the property's own
 * uploaded photo (see DirectoryListing.hero_image_url) — never a stock
 * image. Callers that know there is no photo render <NoPhotoTile> in a
 * compact slot instead; this component's own fallback only covers a photo
 * URL that fails to load, so the box it already occupies isn't left blank.
 */
export function ListingPhoto({
  src,
  alt,
  name,
  className = '',
  sizes,
}: {
  src: string
  alt: string
  /** Property name, for the initials shown if the photo fails to load. */
  name: string
  className?: string
  sizes?: string
}) {
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // A server-rendered <img> can finish failing before hydration attaches
  // onError, so also check its state once mounted.
  useEffect(() => {
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth === 0) setFailed(true)
  }, [src])

  if (failed) {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center gap-1.5 bg-bd-ivory-200 ${className}`}>
        <span className="font-display text-[22px] font-bold text-bd-teal/45" aria-hidden="true">{listingInitials(name)}</span>
        <span className="flex items-center gap-1 text-[12px] font-medium text-bd-slate">
          <ImageOff className="h-3.5 w-3.5" aria-hidden="true" /> Photo unavailable
        </span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      sizes={sizes}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none ${className}`}
    />
  )
}

/**
 * Cover for a property with no photos, filling the same box a photo would:
 * its initials inside an arched doorway (the counter of the "b" in the
 * Beddilo mark) on a soft colour fixed by `colorKey`, so a page of
 * photo-less listings reads as designed rather than broken. Says plainly
 * that there are no photos and never passes for a picture of the property.
 */
export function ListingCover({
  name,
  colorKey,
  note = true,
  className = '',
}: {
  name: string
  /** Stable per property (its slug), so it keeps its colour everywhere. */
  colorKey: string
  /** Show the "No photos yet" note; off for small thumbnails. */
  note?: boolean
  className?: string
}) {
  const tone = coverTone(colorKey)
  return (
    <div
      role="img"
      aria-label={`${name}: no photos yet`}
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{ background: tone.bg }}
    >
      <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path d="M58 150V92a42 42 0 0 1 84 0v58" fill="none" stroke={tone.fg} strokeOpacity="0.16" strokeWidth="1.2" />
        <path d="M70 150V94a30 30 0 0 1 60 0v56Z" fill={tone.fg} fillOpacity="0.08" />
        <text
          x="100" y="122" textAnchor="middle" fontSize="25" fontWeight="600" letterSpacing="0.5"
          fill={tone.fg} fillOpacity="0.85" style={{ fontFamily: 'var(--font-display), sans-serif' }}
        >
          {listingInitials(name)}
        </text>
      </svg>
      {note && (
        <span className="absolute left-2.5 top-2.5 rounded-md bg-white/90 px-2 py-0.5 text-[12px] font-medium text-bd-slate" aria-hidden="true">
          No photos yet
        </span>
      )}
    </div>
  )
}

/**
 * Compact stand-in for a property or room with no photos: the name's
 * initials on a tinted tile, sized by the caller. Says plainly that no
 * photos have been added rather than looking like a broken image.
 */
export function NoPhotoTile({
  name,
  caption = 'No photos yet',
  className = '',
}: {
  name: string
  /** Shown under the initials when the tile is big enough; null hides it. */
  caption?: string | null
  className?: string
}) {
  return (
    <div
      className={`flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-gradient-to-br from-bd-teal-50 to-bd-ivory-200 text-center ${className}`}
      role="img"
      aria-label={`${name}: no photos yet`}
    >
      <span className="font-display text-[20px] font-bold leading-none text-bd-teal/55" aria-hidden="true">
        {listingInitials(name)}
      </span>
      {caption && (
        <span className="px-1 text-[11px] font-medium leading-tight text-bd-slate" aria-hidden="true">{caption}</span>
      )}
    </div>
  )
}
