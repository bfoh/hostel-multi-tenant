'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X, ArrowRight } from 'lucide-react'

const FOREST_DEEP = '#0A3729'
const GOLD = '#D4A24C'
const GOLD_SOFT = '#F5C26B'
const GOLD_DEEP = '#B8842E'
const IVORY = '#F5E9D2'
const HAIR_STRONG = 'rgba(245, 233, 210, 0.18)'

const LINKS = ['Features', 'Locations', 'Pricing', 'FAQ']

/**
 * Mobile navigation — hamburger that opens a full-width slide-down panel with
 * the section links + auth CTAs. Hidden on md+ where the desktop nav shows.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false)

  // Lock body scroll while the panel is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors"
        style={{ border: `1px solid ${HAIR_STRONG}`, color: IVORY }}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Scrim */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={[
          'fixed inset-0 top-[61px] z-40 transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        style={{ background: 'rgba(10,10,8,0.6)', backdropFilter: 'blur(2px)' }}
      />

      {/* Panel */}
      <div
        className={[
          'fixed inset-x-0 top-[61px] z-50 origin-top transition-all duration-300',
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
        ].join(' ')}
        style={{
          background: 'rgba(10,10,8,0.97)',
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${HAIR_STRONG}`,
        }}
      >
        <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4">
          {LINKS.map((l) => (
            <a
              key={l}
              href={`#${l.toLowerCase()}`}
              onClick={() => setOpen(false)}
              className="flex min-h-[48px] items-center rounded-xl px-3 text-[15px] font-medium transition-colors hover:bg-[#F5E9D2]/5"
              style={{ color: IVORY }}
            >
              {l}
            </a>
          ))}

          <div className="mt-2 grid gap-2.5 pt-3" style={{ borderTop: `1px solid ${HAIR_STRONG}` }}>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="flex min-h-[48px] items-center justify-center rounded-full text-[14px] font-medium transition-colors hover:bg-[#F5E9D2]/5"
              style={{ border: `1px solid ${HAIR_STRONG}`, color: IVORY }}
            >
              Log in
            </Link>
            <Link
              href="/signup?plan=trial"
              onClick={() => setOpen(false)}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-full text-[14px] font-semibold"
              style={{
                background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 60%, ${GOLD_DEEP} 100%)`,
                color: FOREST_DEEP,
                boxShadow: '0 6px 20px -8px rgba(212,162,76,0.55)',
              }}
            >
              Start free trial <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>
      </div>
    </div>
  )
}
