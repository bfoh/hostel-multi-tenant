import Link from 'next/link'
import { BeddiloWordmark } from '@/components/brand/beddilo-logo'

const COLUMNS: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: 'Find a stay',
    links: [
      { label: 'Hostels', href: '/browse?type=hostel' },
      { label: 'Hotels', href: '/browse?type=hotel' },
      { label: 'Apartments', href: '/browse?type=apartment' },
      // Region searches, so each label names the region it covers.
      { label: 'Hostels in Greater Accra', href: '/browse?region=Greater%20Accra' },
      { label: 'Hostels in Ashanti', href: '/browse?region=Ashanti' },
      { label: 'Hostels in Central Region', href: '/browse?region=Central' },
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
    <footer className="border-t border-bd-ink/10 bg-bd-mist text-bd-ink">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-14">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" aria-label="Beddilo home" className="bd-focus -m-1 inline-block rounded-md p-1 text-bd-teal">
              <BeddiloWordmark className="h-7 w-auto" title="" />
            </Link>
            <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-bd-slate">
              Hostels, hotels and apartments across Ghana, booked directly with the property.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h2 className="text-[14px] font-semibold text-bd-ink">{col.heading}</h2>
              <ul className="mt-3 space-y-2.5 text-[14px]">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith('mailto:') ? (
                      <a href={l.href} className="bd-focus rounded-sm text-bd-slate transition-colors hover:text-bd-ink hover:underline">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="bd-focus rounded-sm text-bd-slate transition-colors hover:text-bd-ink hover:underline">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-bd-ink/10 pt-6 text-[13px] text-bd-slate sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Beddilo</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="bd-focus rounded-sm hover:text-bd-ink hover:underline">Privacy</Link>
            <Link href="/terms" className="bd-focus rounded-sm hover:text-bd-ink hover:underline">Terms</Link>
            <a href="mailto:support@gh-hostels.com" className="bd-focus rounded-sm hover:text-bd-ink hover:underline">Support</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
