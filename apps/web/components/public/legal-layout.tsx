import Link from 'next/link'
import Image from 'next/image'

const INK = '#0A0A08'
const IVORY = '#F5E9D2'
const GOLD = '#D4A24C'
const HAIR = 'rgba(245, 233, 210, 0.10)'
const HAIR_STRONG = 'rgba(245, 233, 210, 0.18)'

/**
 * Shared shell for public legal pages (Privacy, Terms). Matches the landing
 * palette. `children` is the legal body — use the exported Section/P helpers
 * for consistent styling.
 */
export function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen antialiased" style={{ background: INK, color: IVORY }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-2xl"
        style={{ background: 'rgba(10,10,8,0.72)', borderBottom: `1px solid ${HAIR}` }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo-mark.svg" alt="GH Hostels" width={32} height={32} className="h-8 w-8" />
            <span
              className="text-[14px] font-bold tracking-[0.16em]"
              style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif', color: IVORY }}
            >
              GH-HOSTELS
            </span>
          </Link>
          <Link
            href="/"
            className="text-[13px] font-medium transition-colors hover:opacity-80"
            style={{ color: 'rgba(245,233,210,0.6)' }}
          >
            ← Home
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
        <h1
          className="text-[32px] font-normal leading-[1.1] tracking-[-0.03em] sm:text-[44px]"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: IVORY }}
        >
          {title}
        </h1>
        <p className="mt-3 text-[13px]" style={{ color: 'rgba(245,233,210,0.45)' }}>
          Last updated: {lastUpdated}
        </p>

        {/* Template notice — remove once reviewed by counsel */}
        <div
          className="mt-6 rounded-xl px-4 py-3 text-[12.5px] leading-relaxed"
          style={{ border: `1px solid ${GOLD}40`, background: `${GOLD}14`, color: 'rgba(245,233,210,0.8)' }}
        >
          <strong style={{ color: GOLD }}>Template — review before launch.</strong> This is a
          starting draft. Replace the bracketed placeholders and have it reviewed by a qualified
          lawyer (Ghana Data Protection Act, 2012 / Act 843 and consumer law) before relying on it.
        </div>

        <div className="mt-10 space-y-8">{children}</div>

        <div className="mt-16 border-t pt-6 text-[12px]" style={{ borderColor: HAIR_STRONG, color: 'rgba(245,233,210,0.4)' }}>
          © {new Date().getFullYear()} GH-HOSTELS · Made in Accra, Ghana ·{' '}
          <Link href="/privacy" className="hover:opacity-80" style={{ color: 'rgba(245,233,210,0.55)' }}>Privacy</Link>
          {' · '}
          <Link href="/terms" className="hover:opacity-80" style={{ color: 'rgba(245,233,210,0.55)' }}>Terms</Link>
        </div>
      </main>
    </div>
  )
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: IVORY }}>{heading}</h2>
      <div className="mt-3 space-y-3 text-[14.5px] leading-relaxed" style={{ color: 'rgba(245,233,210,0.72)' }}>
        {children}
      </div>
    </section>
  )
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="ml-5 list-disc space-y-1.5">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  )
}
