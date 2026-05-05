import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { redirect } from 'next/navigation'
import {
  CreditCard, CheckCircle2, Clock, XCircle, AlertCircle,
  Banknote, Wallet, Smartphone, ArrowUpRight,
} from 'lucide-react'
import { PayNowButton } from '@/components/occupant-portal/pay-now-button'
import { BankDepositSection } from '@/components/occupant-portal/bank-deposit-section'

export const metadata: Metadata = { title: 'Payments · My Portal' }

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}
function dateTime(d: string) {
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

const METHOD_ICON: Record<string, React.ElementType> = {
  momo_mtn:        Smartphone,
  momo_vodafone:   Smartphone,
  momo_airteltigo: Smartphone,
  card:            CreditCard,
  bank_transfer:   Banknote,
  cash:            Wallet,
  cheque:          Wallet,
}

const METHOD_LABEL: Record<string, string> = {
  momo_mtn:        'MTN MoMo',
  momo_vodafone:   'Vodafone Cash',
  momo_airteltigo: 'AirtelTigo Money',
  card:            'Card / Online',
  bank_transfer:   'Bank Transfer',
  cash:            'Cash',
  cheque:          'Cheque',
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ pay?: string }> }) {
  const session = await getOccupantSession()
  if (!session) redirect('/occupant-portal')

  const { occupantId, tenantId, tenantColor: color } = session
  const sp     = await searchParams
  const payMsg = sp.pay

  const admin = createAdminClient()

  // Is the hostel able to take online payments? (subaccount connected)
  // Also fetch bank deposit details for the BankDepositSection.
  const { data: tenantRow } = await admin
    .from('tenants')
    .select('paystack_subaccount_code, bank_name, bank_branch, bank_account_name, bank_account_number, bank_swift_code, bank_instructions, bank_deposits_enabled')
    .eq('id', tenantId)
    .single()
  const payEnabled = !!(tenantRow as any)?.paystack_subaccount_code
  const bankDepositsEnabled = !!(tenantRow as any)?.bank_deposits_enabled

  // Fetch bookings + payments
  const { data: bookingsRaw } = await admin
    .from('bookings')
    .select(`
      id, booking_ref, status, final_amount, paid_amount, check_in_date, check_out_date,
      rooms(room_number, block),
      booking_payments(id, amount, method, reference, paystack_reference, paid_at, status, notes, draft_file_path, draft_number, draft_bank_name, rejected_reason, created_at)
    `)
    .eq('occupant_id', occupantId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(20)

  const bookings = bookingsRaw ?? []

  // Find active/upcoming booking for pay-now CTA
  const featured = bookings.find(b => b.status === 'checked_in') ??
                   bookings.find(b => b.status === 'confirmed') ??
                   bookings.find(b => b.status === 'pending_payment') ??
                   null

  const featuredBalance = featured ? featured.final_amount - featured.paid_amount : 0
  const room = featured ? (Array.isArray(featured.rooms) ? featured.rooms[0] : featured.rooms) as any : null

  // Pending bank-draft on the featured booking (at most one per booking — DB-enforced)
  const featuredPayments = featured
    ? (Array.isArray(featured.booking_payments) ? featured.booking_payments : (featured.booking_payments ? [featured.booking_payments] : []))
    : []
  const pendingDraft = (featuredPayments as any[]).find(
    (p) => p.method === 'bank_draft' && p.status === 'pending',
  ) ?? null

  // Flatten all payments sorted by date desc.
  // Use paid_at when available (success rows); fall back to created_at for
  // pending/rejected bank drafts which have no paid_at yet.
  const allPayments = bookings.flatMap(b => {
    const pmts = Array.isArray(b.booking_payments) ? b.booking_payments : (b.booking_payments ? [b.booking_payments] : [])
    return pmts.map((p: any) => ({ ...p, booking_ref: b.booking_ref }))
  }).sort((a, b) => {
    const ta = new Date(a.paid_at ?? a.created_at ?? 0).getTime()
    const tb = new Date(b.paid_at ?? b.created_at ?? 0).getTime()
    return tb - ta
  })

  return (
    <div className="space-y-4">

      {/* ── Payment status toast ─────────────────────────────────── */}
      {payMsg === 'success' && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Payment successful!</p>
            <p className="text-xs text-emerald-600">Your payment has been recorded. Thank you!</p>
          </div>
        </div>
      )}
      {payMsg === 'failed' && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5">
          <XCircle className="h-5 w-5 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-semibold text-red-800">Payment failed</p>
            <p className="text-xs text-red-500">Your payment was not completed. Please try again.</p>
          </div>
        </div>
      )}
      {payMsg === 'error' && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Something went wrong</p>
            <p className="text-xs text-amber-600">We couldn&apos;t verify your payment. Contact reception if money was deducted.</p>
          </div>
        </div>
      )}

      {/* ── Balance summary card ─────────────────────────────────── */}
      {featured ? (
        <section className="overflow-hidden rounded-2xl shadow-sm" style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)` }}>
          <div className="relative px-5 py-5 text-white">
            <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
            <div className="absolute -bottom-4 right-10 h-16 w-16 rounded-full bg-white/5" />

            <div className="relative">
              <p className="text-[12px] text-white/65">
                Room {room?.room_number ?? '—'}{room?.block ? ` · ${room.block}` : ''} · {featured.booking_ref}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-white/15 p-3 text-center">
                  <p className="text-[10px] text-white/60 uppercase tracking-wide">Total</p>
                  <p className="mt-1 text-sm font-bold text-white">{ghs(featured.final_amount)}</p>
                </div>
                <div className="rounded-xl bg-white/15 p-3 text-center">
                  <p className="text-[10px] text-white/60 uppercase tracking-wide">Paid</p>
                  <p className="mt-1 text-sm font-bold text-emerald-200">{ghs(featured.paid_amount)}</p>
                </div>
                <div className="rounded-xl bg-white/15 p-3 text-center">
                  <p className="text-[10px] text-white/60 uppercase tracking-wide">Balance</p>
                  <p className={`mt-1 text-sm font-bold ${featuredBalance > 0 ? 'text-red-200' : 'text-emerald-200'}`}>
                    {featuredBalance > 0 ? ghs(featuredBalance) : 'Nil ✓'}
                  </p>
                </div>
              </div>

              {featuredBalance > 0 && payEnabled && (
                <div className="relative mt-4">
                  <PayNowButton
                    bookingId={featured.id}
                    balance={featuredBalance}
                    color={color}
                  />
                </div>
              )}
              {featuredBalance > 0 && !payEnabled && (
                <div className="relative mt-4 rounded-xl bg-white/15 px-4 py-3 text-center">
                  <p className="text-sm font-semibold text-white">Pay at reception</p>
                  <p className="mt-0.5 text-[11px] text-white/70">
                    Online payment is not yet enabled for this hostel.
                  </p>
                </div>
              )}
              {featuredBalance <= 0 && (
                <div className="relative mt-4 flex items-center justify-center gap-2 rounded-xl bg-white/15 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                  <p className="text-sm font-semibold text-emerald-100">Fully paid — no balance due</p>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <CreditCard className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-500">No active bookings</p>
          <p className="text-xs text-slate-400 mt-0.5">Contact reception to make a booking.</p>
        </div>
      )}

      {/* ── Bank deposit section (collapsed by default) ──────────── */}
      {featured && bankDepositsEnabled && (
        <BankDepositSection
          bookingId={featured.id}
          balance={featuredBalance}
          bankDetails={{
            bank_name:           (tenantRow as any)?.bank_name           ?? null,
            bank_branch:         (tenantRow as any)?.bank_branch         ?? null,
            bank_account_name:   (tenantRow as any)?.bank_account_name   ?? null,
            bank_account_number: (tenantRow as any)?.bank_account_number ?? null,
            bank_swift_code:     (tenantRow as any)?.bank_swift_code     ?? null,
            bank_instructions:   (tenantRow as any)?.bank_instructions   ?? null,
          }}
          pending={pendingDraft ? {
            id:           pendingDraft.id,
            amount:       pendingDraft.amount,
            draft_number: pendingDraft.draft_number ?? null,
            created_at:   pendingDraft.created_at,
          } : null}
          color={color}
        />
      )}

      {/* ── All bookings breakdown ───────────────────────────────── */}
      {bookings.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-800">Booking Accounts</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {bookings.map(b => {
              const bal = b.final_amount - b.paid_amount
              const r   = (Array.isArray(b.rooms) ? b.rooms[0] : b.rooms) as any
              return (
                <div key={b.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Room {r?.room_number ?? '—'}{r?.block ? ` · ${r.block}` : ''}</p>
                      <p className="font-mono text-[11px] text-slate-400">{b.booking_ref}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{ghs(b.final_amount)}</p>
                      {bal > 0 ? (
                        <p className="text-[11px] font-medium text-red-500">{ghs(bal)} due</p>
                      ) : (
                        <p className="text-[11px] font-medium text-emerald-600">Paid in full</p>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (b.paid_amount / Math.max(1, b.final_amount)) * 100)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {Math.round((b.paid_amount / Math.max(1, b.final_amount)) * 100)}% paid
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Payment history ──────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-800">Payment History</h2>
        </div>

        {allPayments.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Wallet className="mx-auto h-7 w-7 text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">No payments recorded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {allPayments.map((p: any) => {
              const Icon       = METHOD_ICON[p.method] ?? CreditCard
              const isSuccess  = p.status === 'success'
              const isPending  = p.status === 'pending'
              const isRejected = p.status === 'failed'
              const tint       = isSuccess ? `${color}18` : isPending ? '#fef3c7' : '#fee2e2'
              const iconColor  = isSuccess ? color : isPending ? '#b45309' : '#dc2626'
              const tsLabel    = p.paid_at ? dateTime(p.paid_at) : (p.created_at ? dateTime(p.created_at) : '—')
              return (
                <div key={p.id} className="flex items-center gap-3.5 px-5 py-3.5">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: tint }}
                  >
                    <Icon className="h-4 w-4" style={{ color: iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{METHOD_LABEL[p.method] ?? p.method}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {p.booking_ref}
                      {(p.reference || p.paystack_reference) && ` · ${(p.reference ?? p.paystack_reference).slice(0, 16)}`}
                    </p>
                    <p className="text-[10px] text-slate-400">{tsLabel}</p>
                    {isRejected && p.rejected_reason && (
                      <p className="mt-0.5 truncate text-[11px] text-red-600" title={p.rejected_reason}>
                        Rejected — {p.rejected_reason}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900">{ghs(p.amount)}</p>
                    {isSuccess && (
                      <span className="flex items-center justify-end gap-0.5 text-[10px] text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> Confirmed
                      </span>
                    )}
                    {isPending && (
                      <span className="flex items-center justify-end gap-0.5 text-[10px] text-amber-600">
                        <Clock className="h-3 w-3" /> Awaiting verification
                      </span>
                    )}
                    {isRejected && (
                      <span className="flex items-center justify-end gap-0.5 text-[10px] text-red-600">
                        <XCircle className="h-3 w-3" /> Rejected
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Info note ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
        <p className="flex items-start gap-2 text-xs text-slate-500">
          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          Cash payments recorded by reception may take a few minutes to appear here. For payment disputes, contact hostel management.
        </p>
      </div>

    </div>
  )
}
