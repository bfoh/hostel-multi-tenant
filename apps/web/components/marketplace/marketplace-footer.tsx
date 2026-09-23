import Image from 'next/image'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { MP } from '@/lib/marketplace-theme'

/**
 * Shared footer for all four marketplace surfaces (homepage, /browse,
 * /listing/[slug], /for-owners) — previously duplicated between the
 * homepage and /for-owners, and absent entirely from the other two.
 */
export function MarketplaceFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${MP.border}`, background: MP.surface }}>
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo-mark.svg" alt="GH-HOSTELS" width={32} height={32} className="h-8 w-8" />
              <span className="text-[13px] font-bold tracking-[0.16em]" style={{ color: MP.ink }}>
                GH-HOSTELS
              </span>
            </Link>
            <p className="mt-4 text-[13px] leading-relaxed" style={{ color: MP.textSecondary }}>
              Find and book student hostels across Ghana — real-time availability, no middleman.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: MP.goldDeep }}>
              Find a Hostel
            </p>
            <ul className="mt-4 space-y-2.5 text-[13px]" style={{ color: MP.textSecondary }}>
              <li><Link href="/browse" className="hover:underline">Browse all hostels</Link></li>
              <li><Link href="/browse?region=Greater%20Accra" className="hover:underline">Hostels in Accra</Link></li>
              <li><Link href="/browse?region=Ashanti" className="hover:underline">Hostels in Kumasi</Link></li>
              <li><Link href="/browse?region=Central" className="hover:underline">Hostels in Cape Coast</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: MP.goldDeep }}>
              For Hostel Owners
            </p>
            <ul className="mt-4 space-y-2.5 text-[13px]" style={{ color: MP.textSecondary }}>
              <li><Link href="/for-owners" className="hover:underline">Management system</Link></li>
              <li><Link href="/for-owners#pricing" className="hover:underline">Pricing</Link></li>
              <li><Link href="/for-owners#faq" className="hover:underline">FAQ</Link></li>
              <li><Link href="/signup?plan=trial&source=directory" className="hover:underline">List your hostel free</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: MP.goldDeep }}>
              Company
            </p>
            <ul className="mt-4 space-y-2.5 text-[13px]" style={{ color: MP.textSecondary }}>
              <li><a href="mailto:hello@gh-hostels.com" className="hover:underline">Contact</a></li>
              <li><a href="mailto:support@gh-hostels.com" className="hover:underline">Support</a></li>
              <li><Link href="/login" className="hover:underline">Log in</Link></li>
              <li className="inline-flex items-center gap-2 pt-1">
                <Lock className="h-3.5 w-3.5" style={{ color: MP.goldDeep }} /> Encrypted &amp; secure
              </li>
            </ul>
          </div>
        </div>

        <div
          className="mt-10 flex flex-col items-center justify-between gap-4 pt-6 sm:flex-row"
          style={{ borderTop: `1px solid ${MP.border}` }}
        >
          <p className="text-[12px]" style={{ color: MP.textSecondary }}>
            © {new Date().getFullYear()} GH Hostels · Made in Accra, Ghana
          </p>
          <div className="flex gap-6 text-[12px]" style={{ color: MP.textSecondary }}>
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            <Link href="/terms" className="hover:underline">Terms</Link>
            <a href="mailto:support@gh-hostels.com" className="hover:underline">Support</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
