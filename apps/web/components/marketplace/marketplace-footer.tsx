import Link from 'next/link'
import { BeddiloWordmark } from '@/components/brand/beddilo-logo'

const COLUMNS: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: 'Find a stay',
    links: [
      { label: 'Hostels', href: '/browse?type=hostel' },
      { label: 'Hotels', href: '/browse?type=hotel' },
      { label: 'Apartments', href: '/browse?type=apartment' },
      { label: 'Hostels in Accra', href: '/browse?region=Greater%20Accra' },
      { label: 'Hostels in Kumasi', href: '/browse?region=Ashanti' },
      { label: 'Hostels in Cape Coast', href: '/browse?region=Central' },
    ],
  },
  {
    heading: 'For property owners',
    links: [
      { label: 'List your property', href: '/list-your-property' },
      { label: 'Management system', href: '/for-owners' },
      { label: 'Pricing', href: '/for-owners#pricing' },
      { label: 'FAQ', href: '/for-owners#faq' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Contact', href: 'mailto:hello@gh-hostels.com' },
      { label: 'Support', href: 'mailto:support@gh-hostels.com' },
      { label: 'Log in', href: '/login' },
    ],
  },
]

/**
 * Shared footer for all four marketplace surfaces (homepage, /browse,
 * /listing/[slug], /for-owners) — previously duplicated between the
 * homepage and /for-owners, and absent entirely from the other two.
 */
export function MarketplaceFooter() {
  return (
    <footer className="border-t border-bd-teal/10 bg-bd-teal text-bd-ivory">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label="Beddilo home" className="bd-focus-on-dark -m-1 inline-block rounded-md p-1 text-bd-ivory">
              <BeddiloWordmark className="h-8 w-auto" title="" />
            </Link>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-bd-amber">
              A world of stays
            </p>
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-bd-ivory/75">
              Find your stay. Feel at home. Hotels, student hostels and apartments,
              booked directly with the property.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-bd-ivory/60">
                {col.heading}
              </p>
              <ul className="mt-4 space-y-2.5 text-[14px]">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith('mailto:') ? (
                      <a href={l.href} className="bd-focus-on-dark rounded-sm text-bd-ivory/85 transition-colors hover:text-bd-amber">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="bd-focus-on-dark rounded-sm text-bd-ivory/85 transition-colors hover:text-bd-amber">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-bd-ivory/15 pt-6 text-[13px] text-bd-ivory/65 sm:flex-row">
          <p>© {new Date().getFullYear()} Beddilo. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="bd-focus-on-dark rounded-sm transition-colors hover:text-bd-amber">Privacy</Link>
            <Link href="/terms" className="bd-focus-on-dark rounded-sm transition-colors hover:text-bd-amber">Terms</Link>
            <a href="mailto:support@gh-hostels.com" className="bd-focus-on-dark rounded-sm transition-colors hover:text-bd-amber">Support</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
