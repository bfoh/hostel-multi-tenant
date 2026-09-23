'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Menu, X, ArrowRight } from 'lucide-react'
import { MP } from '@/lib/marketplace-theme'

const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: 'Find a Hostel', href: '/hostels' },
  { label: 'For Hostel Owners', href: '/for-owners' },
  { label: 'Pricing', href: '/for-owners#pricing' },
  { label: 'FAQ', href: '/for-owners#faq' },
]

/**
 * Shared top nav for all four marketplace surfaces (homepage, /hostels,
 * /hostels/[slug], /for-owners) — one implementation instead of three
 * slightly-different copies, with the mobile hamburger menu folded in
 * (previously a separate MobileNav component).
 */
export function MarketplaceNav() {
  const [open, setOpen] = useState(false)

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
      className="sticky top-0 z-50 backdrop-blur-md"
      style={{
        background: 'rgba(255,255,255,0.92)',
        borderBottom: `1px solid ${MP.border}`,
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo-mark.svg" alt="GH Hostels" width={32} height={32} className="h-8 w-8" />
          <span className="text-[14px] font-bold tracking-[0.14em]" style={{ color: MP.ink }}>
            GH-HOSTELS
          </span>
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-[13px] font-medium tracking-[0.04em] transition-colors"
              style={{ color: MP.textSecondary }}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-[13px] font-medium lg:inline-flex"
            style={{ color: MP.textSecondary }}
          >
            Log in
          </Link>
          <Link
            href="/signup?plan=trial&source=directory"
            className="hidden rounded-full px-4 py-2 text-[13px] font-semibold lg:inline-flex"
            style={{
              background: `linear-gradient(135deg, ${MP.goldSoft} 0%, ${MP.gold} 60%, ${MP.goldDeep} 100%)`,
              color: MP.ink,
              boxShadow: '0 6px 16px -8px rgba(212,162,76,0.55)',
            }}
          >
            List your hostel free
          </Link>

          {/* Mobile hamburger */}
          <div className="lg:hidden">
            <button
              type="button"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full"
              style={{ border: `1px solid ${MP.border}`, color: MP.ink }}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <div
              onClick={() => setOpen(false)}
              aria-hidden="true"
              className={[
                'fixed inset-0 z-40 transition-opacity duration-300',
                open ? 'opacity-100' : 'pointer-events-none opacity-0',
              ].join(' ')}
              style={{ top: 'calc(57px + env(safe-area-inset-top))', background: 'rgba(20,35,29,0.25)' }}
            />

            <div
              className={[
                'fixed inset-x-0 z-50 origin-top transition-all duration-300',
                open ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
              ].join(' ')}
              style={{
                top: 'calc(57px + env(safe-area-inset-top))',
                background: MP.surface,
                borderBottom: `1px solid ${MP.border}`,
              }}
            >
              <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4">
                {NAV_LINKS.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-[48px] items-center rounded-xl px-3 text-[15px] font-medium"
                    style={{ color: MP.ink }}
                  >
                    {l.label}
                  </Link>
                ))}
                <div className="mt-2 grid gap-2.5 pt-3" style={{ borderTop: `1px solid ${MP.border}` }}>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="flex min-h-[48px] items-center justify-center rounded-full text-[14px] font-medium"
                    style={{ border: `1px solid ${MP.border}`, color: MP.ink }}
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup?plan=trial&source=directory"
                    onClick={() => setOpen(false)}
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-full text-[14px] font-semibold"
                    style={{
                      background: `linear-gradient(135deg, ${MP.goldSoft} 0%, ${MP.gold} 60%, ${MP.goldDeep} 100%)`,
                      color: MP.ink,
                    }}
                  >
                    List your hostel free <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
