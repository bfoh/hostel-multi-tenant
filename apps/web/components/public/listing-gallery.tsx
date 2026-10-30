'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ListingPhoto } from '@/components/public/listing-photo'

/**
 * Property photo gallery: one swipeable strip (scroll-snap) at every size,
 * with a photo counter, previous/next buttons and thumbnails on larger
 * screens, and arrow keys when the strip has focus. Only the owner's own
 * uploads are ever passed in.
 */
export function ListingGallery({ photos, name }: { photos: string[]; name: string }) {
  const stripRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const count = photos.length

  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const onScroll = () => setIndex(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [count])

  function go(i: number) {
    const el = stripRef.current
    if (!el) return
    const n = (i + count) % count
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: n * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' })
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1) }
  }

  return (
    <section aria-roledescription="carousel" aria-label={`Photos of ${name}`}>
      <div className="relative overflow-hidden rounded-2xl bg-bd-ivory-200">
        <div
          ref={stripRef}
          tabIndex={count > 1 ? 0 : undefined}
          onKeyDown={count > 1 ? onKeyDown : undefined}
          aria-label={count > 1 ? 'Photos — use the arrow keys to move between them' : undefined}
          className="bd-focus mp-no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-2xl"
        >
          {photos.map((src, i) => (
            <div
              key={`${src}-${i}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              className="aspect-[4/3] w-full shrink-0 snap-center sm:aspect-[16/9] lg:aspect-[5/2]"
            >
              <ListingPhoto
                src={src}
                alt={`${name}, photo ${i + 1} of ${count}`}
                name={name}
                sizes="(min-width: 1152px) 1104px, 100vw"
              />
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-bd-teal-950/70 px-2.5 py-1 text-[12px] font-semibold text-white">
              {index + 1} / {count}
            </span>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous photo"
              className="bd-focus absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-bd-teal shadow-sm transition-colors hover:bg-white sm:flex"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next photo"
              className="bd-focus absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-bd-teal shadow-sm transition-colors hover:bg-white sm:flex"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <ul className="mp-no-scrollbar mt-2 hidden gap-2 overflow-x-auto p-0.5 sm:flex">
          {photos.map((src, i) => (
            <li key={`${src}-thumb-${i}`} className="shrink-0">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                className={`bd-focus block h-16 w-24 overflow-hidden rounded-lg ring-2 transition-opacity ${i === index ? 'ring-bd-teal' : 'opacity-75 ring-transparent hover:opacity-100'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
