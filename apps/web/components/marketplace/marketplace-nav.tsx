'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Menu, X, ArrowRight } from 'lucide-react'
import { BeddiloWordmark } from '@/components/brand/beddilo-logo'

const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: 'Find a stay', href: '/browse' },
  { label: 'List your property', href: '/list-your-property' },
  { label: 'Pricing', href: '/for-owners#pricing' },
  { label: 'FAQ', href: '/for-owners#faq' },
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
      className="sticky top-0 z-50 border-b border-bd-teal/10 bg-bd-ivory-50/90 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Beddilo home" className="bd-focus -m-1 rounded-md p-1 text-bd-teal">
          <BeddiloWordmark className="h-[26px] w-auto sm:h-7" title="" />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="bd-focus rounded-full px-3.5 py-2 text-[14px] font-medium text-bd-slate transition-colors hover:bg-bd-teal/5 hover:text-bd-teal"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="bd-focus hidden rounded-full px-3.5 py-2 text-[14px] font-medium text-bd-teal transition-colors hover:bg-bd-teal/5 lg:inline-flex"
          >
            Log in
          </Link>
          <Link
            href="/list-your-property"
            className="bd-focus hidden items-center rounded-full bg-bd-amber px-4 py-2 text-[14px] font-semibold text-bd-teal shadow-[0_6px_16px_-8px_rgba(227,162,63,0.7)] transition-colors hover:bg-bd-amber-600 lg:inline-flex"
          >
            List your property
          </Link>

          {/* Mobile hamburger */}
          <div className="lg:hidden">
            <button
              type="button"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              aria-controls="marketplace-mobile-menu"
              onClick={() => setOpen((v) => !v)}
              className="bd-focus inline-flex h-11 w-11 items-center justify-center rounded-full border border-bd-teal/15 text-bd-teal transition-colors hover:bg-bd-teal/5"
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
                    'fixed inset-0 z-40 bg-bd-teal/25 transition-opacity duration-300',
                    open ? 'opacity-100' : 'pointer-events-none opacity-0',
                  ].join(' ')}
                  style={{ top: NAV_OFFSET }}
                />

                <div
                  id="marketplace-mobile-menu"
                  className={[
                    'fixed inset-x-0 z-50 origin-top border-b border-bd-teal/10 bg-white transition-all duration-300',
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
                        className="bd-focus flex min-h-[48px] items-center rounded-xl px-3 text-[15px] font-medium text-bd-teal hover:bg-bd-ivory"
                      >
                        {l.label}
                      </Link>
                    ))}
                    <div className="mt-2 grid gap-2.5 border-t border-bd-teal/10 pt-3">
                      <Link
                        href="/login"
                        onClick={() => setOpen(false)}
                        className="bd-focus flex min-h-[48px] items-center justify-center rounded-full border border-bd-teal/20 text-[15px] font-medium text-bd-teal"
                      >
                        Log in
                      </Link>
                      <Link
                        href="/list-your-property"
                        onClick={() => setOpen(false)}
                        className="bd-focus flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-bd-amber text-[15px] font-semibold text-bd-teal hover:bg-bd-amber-600"
                      >
                        List your property <ArrowRight className="h-4 w-4" />
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
