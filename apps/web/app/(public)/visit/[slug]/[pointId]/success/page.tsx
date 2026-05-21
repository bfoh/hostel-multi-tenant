import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTransaction } from '@/lib/paystack'
import { Check, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Payment receipt' }

interface PageProps {
  params:       Promise<{ slug: string; pointId: string }>
  searchParams: Promise<{ ref?: string; reference?: string; trxref?: string; token?: string; cash?: string }>
}

export default async function VisitSuccessPage({ params, searchParams }: PageProps) {
  const { slug, pointId } = await params
  const sp = await searchParams
  const reference = sp.ref ?? sp.reference ?? sp.trxref
  const expectedToken = sp.token ?? null
  const isCash = sp.cash === '1'

  const supabase = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, logo_url, primary_color, contact_phone')
    .eq('slug', slug)
    .single()

  if (!tenant) notFound()

  const { data: pointRaw } = await supabase
    .from('revenue_points')
    .select('id, name, type, public_config')
    .eq('id', pointId)
    .eq('tenant_id', tenant.id)
    .single()
  const point = pointRaw as any
  if (!point) notFound()

  const brand = tenant.primary_color ?? '#2563EB'

  // Cash-on-pickup path: look the sale up by reference + token; nothing to
  // verify with Paystack.
  let cashSale: { status: string; amount: number; description: string } | null = null
  if (isCash && reference) {
    const { data } = await (supabase as any)
      .from('revenue_point_sales')
      .select('status, total_amount, description, entry_token')
      .eq('tenant_id', tenant.id)
      .eq('reference', reference)
      .maybeSingle()
    if (data && (!expectedToken || data.entry_token === expectedToken)) {
      cashSale = { status: data.status, amount: data.total_amount, description: data.description }
    }
  }

  // Verify the Paystack transaction (no DB writes here — webhook owns that)
  let charge: { status: string; amount: number; channel?: string } | null = null
  if (!isCash && reference) {
    try {
      const result = await verifyTransaction(reference)
      charge = { status: result.status, amount: result.amount, channel: (result as any).channel }
    } catch {
      charge = null
    }
  }

  const ok = isCash ? cashSale !== null : charge?.status === 'success'

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Inter, sans-serif' }}>
      <header style={{ background: `linear-gradient(135deg, ${brand} 0%, ${brand}CC 100%)` }}>
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-6 text-white">
          {tenant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover bg-white/20 p-1" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-lg font-bold">
              {tenant.name[0]}
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70">{tenant.name}</p>
            <h1 className="text-lg font-bold leading-tight">{point.name}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-8">
        {!reference ? (
          <ErrorCard
            title="Missing reference"
            message="No payment reference was passed back. Contact the hostel if you were charged."
          />
        ) : charge === null ? (
          <ErrorCard
            title="Could not verify"
            message="We couldn't reach Paystack to confirm your payment. Refresh in a few seconds."
          />
        ) : !ok ? (
          <ErrorCard
            title="Payment not completed"
            message="The transaction did not finish. Try again or pay at the counter."
          />
        ) : (
          <SuccessCard
            brand={brand}
            amountPesewas={isCash ? cashSale!.amount : charge!.amount}
            entryToken={expectedToken}
            type={point.type as string}
            pointName={point.name}
            contactPhone={tenant.contact_phone}
            turnaroundHours={Number(point.public_config?.turnaround_hours ?? 24)}
            isCash={isCash}
          />
        )}
      </main>
    </div>
  )
}

function ghs(p: number) {
  return `GH₵ ${(p / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function SuccessCard({
  brand, amountPesewas, entryToken, type, pointName, contactPhone, turnaroundHours, isCash,
}: {
  brand:           string
  amountPesewas:   number
  entryToken:      string | null
  type:            string
  pointName:       string
  contactPhone:    string | null
  turnaroundHours: number
  isCash?:         boolean
}) {
  const onlineInstructions =
    type === 'gym'     ? 'Show this code at the gym entrance.'
  : type === 'sports'  ? 'Show this code at the counter to claim your court.'
  : type === 'laundry' ? `Show this code when picking up your laundry — ready in ~${turnaroundHours} hours.`
                       : 'Keep this code as your receipt.'

  const cashInstructions =
    type === 'gym'     ? 'Show this code and pay cash at the gym entrance.'
  : type === 'sports'  ? 'Show this code at the counter and pay cash when you claim your court.'
  : type === 'laundry' ? `Drop your items at the counter with this code. Pay cash on pickup — ready in ~${turnaroundHours} hours.`
                       : 'Show this code at the counter and pay cash.'

  const instructions = isCash ? cashInstructions : onlineInstructions
  const headline     = isCash ? 'Booking reserved' : 'Payment received'
  const subline      = isCash ? `${pointName} · ${ghs(amountPesewas)} due on pickup` : `${pointName} · ${ghs(amountPesewas)}`

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: `${brand}15` }}
        >
          <Check className="h-7 w-7" style={{ color: brand }} />
        </div>
        <p className="text-lg font-bold text-gray-900">{headline}</p>
        <p className="text-sm text-gray-500">{subline}</p>
      </div>

      {entryToken && (
        <div className="rounded-xl border-2 border-dashed py-4 text-center" style={{ borderColor: brand }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            {type === 'laundry' ? 'Pickup code' : 'Entry code'}
          </p>
          <p
            className="mt-1 font-mono text-3xl font-bold tracking-[0.3em]"
            style={{ color: brand }}
          >
            {entryToken}
          </p>
        </div>
      )}

      <p className="text-sm text-gray-600 text-center">{instructions}</p>

      <p className="text-center text-[11px] text-gray-400">
        Receipt has also been sent by SMS.
        {contactPhone && <> Need help? Call <a href={`tel:${contactPhone}`} className="underline">{contactPhone}</a>.</>}
      </p>
    </div>
  )
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm space-y-3 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <AlertCircle className="h-6 w-6 text-red-600" />
      </div>
      <p className="text-lg font-bold text-gray-900">{title}</p>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}
