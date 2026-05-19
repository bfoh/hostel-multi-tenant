import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { createAdminClient } from '@/lib/supabase/admin'
import { PrintButton } from '@/components/invoices/print-button'

export const metadata: Metadata = { title: 'QR sheet' }
export const dynamic = 'force-dynamic'

interface PageProps {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ copies?: string }>
}

export default async function QrPrintPage({ params, searchParams }: PageProps) {
  const { id }      = await params
  const sp          = await searchParams
  const copies      = Math.min(24, Math.max(1, parseInt(sp.copies ?? '6', 10) || 6))

  const h        = await headers()
  const tenantId = h.get('x-tenant-id')
  const host     = h.get('host') ?? 'localhost:3000'
  const proto    = host.includes('localhost') ? 'http' : 'https'
  const base     = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`
  if (!tenantId) notFound()

  const supabase = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, logo_url, primary_color')
    .eq('id', tenantId)
    .single()
  if (!tenant) notFound()

  const { data: point } = await supabase
    .from('revenue_points')
    .select('id, name, type, public_enabled')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!point) notFound()

  const type = (point as any).type as string
  const isRestaurant = type === 'restaurant' || type === 'cafeteria'
  const targetUrl = isRestaurant
    ? `${base}/order/${tenant.slug}`
    : `${base}/visit/${tenant.slug}/${id}`

  // Render the QR once to data URL (printed sheets re-use the same image)
  const qrDataUrl = await QRCode.toDataURL(targetUrl, {
    width: 600,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#0F172A', light: '#FFFFFF' },
  })

  const brand = tenant.primary_color ?? '#2563EB'
  const headline =
    isRestaurant ? 'Scan to order food'
  : type === 'gym'      ? 'Scan to enter the gym'
  : type === 'sports'   ? 'Scan to book the court'
  : type === 'laundry'  ? 'Scan to pay for laundry'
                        : 'Scan to pay'

  const sub =
    isRestaurant ? 'Dine in, takeaway or order ahead — all online.'
                 : 'Mobile Money · Card · Bank Transfer'

  const cards = Array.from({ length: copies })

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-4 px-6 py-6 print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">QR sheet — {(point as any).name}</h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Target URL: <code className="rounded bg-surface-raised px-1 py-0.5">{targetUrl}</code>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <form className="flex items-center gap-2 text-sm">
              <label className="text-text-secondary">Copies</label>
              <select
                name="copies"
                defaultValue={String(copies)}
                className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
              >
                {[1, 2, 4, 6, 8, 12, 16, 24].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-sunken transition-colors"
              >
                Update
              </button>
            </form>
            <a
              href={`/api/revenue-points/${id}/qr?size=1024`}
              download={`qr-${(point as any).id}.png`}
              className="rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium"
            >
              Download PNG
            </a>
            <PrintButton />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl p-6 print:p-0">
        <div className="grid grid-cols-2 gap-4 print:grid-cols-2 print:gap-3">
          {cards.map((_, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-3 break-inside-avoid rounded-2xl border border-gray-200 bg-white p-6 text-center"
              style={{ pageBreakInside: 'avoid' }}
            >
              <div className="flex items-center gap-2">
                {tenant.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tenant.logo_url} alt="" className="h-8 w-8 rounded-md object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-sm font-bold text-gray-700">
                    {tenant.name[0]}
                  </div>
                )}
                <span className="text-sm font-semibold text-gray-900">{tenant.name}</span>
              </div>

              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: brand }}>
                {(point as any).name}
              </p>

              <h2 className="text-base font-bold text-gray-900">{headline}</h2>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR code" className="h-56 w-56" />

              <p className="text-xs text-gray-500">{sub}</p>
              <p className="text-[10px] text-gray-400 break-all">{targetUrl}</p>
            </div>
          ))}
        </div>
      </main>

      <style>{`
        @media print {
          @page { margin: 12mm; }
          body { background: white !important; }
        }
      `}</style>
    </>
  )
}
