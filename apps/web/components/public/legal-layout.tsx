import { MarketplaceNav } from '@/components/marketplace/marketplace-nav'
import { MarketplaceFooter } from '@/components/marketplace/marketplace-footer'

/**
 * Shared shell for public legal pages (Privacy, Terms), on the marketplace
 * nav/footer so they read as part of the same site. `children` is the legal
 * body — use the exported Section/P helpers for consistent styling.
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
    <div className="min-h-screen bg-bd-ivory text-bd-teal antialiased">
      <MarketplaceNav />

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-[32px] font-bold leading-[1.1] tracking-[-0.025em] text-bd-teal sm:text-[44px]">
          {title}
        </h1>
        <p className="mt-3 text-[13px] text-bd-slate">Last updated: {lastUpdated}</p>

        {/* Template notice — remove once reviewed by counsel */}
        <div className="mt-6 rounded-xl border border-bd-amber/50 bg-bd-amber-100 px-4 py-3 text-[13px] leading-relaxed text-bd-teal">
          <strong className="text-bd-amber-700">Template — review before launch.</strong> This is a
          starting draft. Replace the bracketed placeholders and have it reviewed by a qualified
          lawyer (Ghana Data Protection Act, 2012 / Act 843 and consumer law) before relying on it.
        </div>

        <div className="mt-10 space-y-8">{children}</div>
      </main>

      <MarketplaceFooter />
    </div>
  )
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-[19px] font-bold tracking-tight text-bd-teal">{heading}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-bd-slate">
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
