'use client'

import { useEffect, useRef, useState } from 'react'
import { BedDouble, Building2 } from 'lucide-react'

/**
 * Listing hero photo with a branded fallback. Only ever shows the
 * property's own uploaded photo (see DirectoryListing.hero_image_url) —
 * when there isn't one, or it fails to load, we show a neutral
 * placeholder rather than substituting a stock image.
 */
export function ListingPhoto({
  src,
  alt,
  businessType,
  className = '',
}: {
  src: string | null
  alt: string
  businessType: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // A server-rendered <img> can finish failing before hydration attaches
  // onError, so also check its state once mounted.
  useEffect(() => {
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth === 0) setFailed(true)
  }, [src])

  if (!src || failed) {
    const Icon = businessType === 'hostel' ? BedDouble : Building2
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-bd-teal-50 to-bd-ivory-200 ${className}`}
      >
        <Icon className="h-9 w-9 text-bd-teal/35" strokeWidth={1.5} aria-hidden="true" />
        <span className="text-[12px] font-medium text-bd-slate">No photos yet</span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none ${className}`}
    />
  )
}
