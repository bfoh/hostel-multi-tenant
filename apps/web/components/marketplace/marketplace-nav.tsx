'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Menu, X, ArrowRight } from 'lucide-react'
import { BeddiloWordmark } from '@/components/brand/beddilo-logo'

const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: 'Hostels', href: '/browse' },
  { label: 'Hotels', href: '/browse?type=hotel' },
  { label: 'Apartments', href: '/browse?type=apartment' },
  { label: 'For property owners', href: '/for-owners' },
]

/** Nav bar height (h-16) plus its 1px bottom border — the mobile menu
 *  overlay is positioned directly below it. */
const NAV_OFFSET = 'calc(4rem + 1px + env(safe-area-inset-top))'

/**
 * Shared top nav for all four marketplace surfaces (homepage, /browse,
 * /listing/[slug], /for-owners) — one implementation instead of three
 * slightly-different copies, with the mobile hamburger menu folded in
 * (previously a separate MobileNav component).
 */
export function MarketplaceNav() {
  const [open, setOpen] = useState(false)
  // The mobile menu overlay/panel are portaled to document.body (see below) —
  // they can only mount client-side, after document exists.
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <nav
      aria-label="Main"
      className="sticky top-0 z-50 border-b border-bd-ink/10 bg-white/95 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="Beddilo home" className="bd-focus -m-1 rounded-md p-1 text-bd-teal">
            <BeddiloWordmark className="h-[26px] w-auto sm:h-7" title="" />
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="bd-focus rounded-md px-3 py-2 text-[14px] font-medium text-bd-ink/80 transition-colors hover:bg-bd-mist hover:text-bd-ink"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/list-your-property"
            className="bd-focus hidden rounded-md px-3 py-2 text-[14px] font-semibold text-bd-teal transition-colors hover:bg-bd-mist lg:inline-flex"
          >
            List your property
          </Link>
          <Link
            href="/login"
            className="bd-focus hidden min-h-[40px] items-center rounded-lg border border-bd-ink/20 px-4 text-[14px] font-semibold text-bd-ink transition-colors hover:border-bd-ink/40 hover:bg-bd-mist lg:inline-flex"
          >
            Log in
          </Link>

          {/* Mobile hamburger */}
          <div className="lg:hidden">
            <button
              type="button"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              aria-controls="marketplace-mobile-menu"
              onClick={() => setOpen((v) => !v)}
              className="bd-focus inline-flex h-11 w-11 items-center justify-center rounded-lg text-bd-ink transition-colors hover:bg-bd-mist"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {/* Portaled to document.body — the nav's own backdrop-blur-md makes
                it a containing block for position:fixed descendants, which
                otherwise collapses this overlay's height to the nav bar's own
                height instead of the full viewport below it. */}
            {mounted && createPortal(
              <>
                <div
                  onClick={() => setOpen(false)}
                  aria-hidden="true"
                  className={[
                    'fixed inset-0 z-40 bg-bd-ink/25 transition-opacity duration-300',
                    open ? 'opacity-100' : 'pointer-events-none opacity-0',
                  ].join(' ')}
                  style={{ top: NAV_OFFSET }}
                />

                <div
                  id="marketplace-mobile-menu"
                  className={[
                    'fixed inset-x-0 z-50 origin-top border-b border-bd-ink/10 bg-white transition-all duration-300',
                    open ? 'visible translate-y-0 opacity-100' : 'pointer-events-none invisible -translate-y-2 opacity-0',
                  ].join(' ')}
                  style={{ top: NAV_OFFSET }}
                >
                  <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4">
                    {NAV_LINKS.map((l) => (
                      <Link
                        key={l.label}
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className="bd-focus flex min-h-[48px] items-center rounded-lg px-3 text-[16px] font-medium text-bd-ink hover:bg-bd-mist"
                      >
                        {l.label}
                      </Link>
                    ))}
                    <div className="mt-2 grid gap-2.5 border-t border-bd-ink/10 pt-3">
                      <Link
                        href="/login"
                        onClick={() => setOpen(false)}
                        className="bd-focus flex min-h-[48px] items-center justify-center rounded-lg border border-bd-ink/20 text-[15px] font-semibold text-bd-ink"
                      >
                        Log in
                      </Link>
                      <Link
                        href="/list-your-property"
                        onClick={() => setOpen(false)}
                        className="bd-focus flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-bd-teal text-[15px] font-semibold text-white hover:bg-bd-teal-900"
                      >
                        List your property <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>
              </>,
              document.body
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
