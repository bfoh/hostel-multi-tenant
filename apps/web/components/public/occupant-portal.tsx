'use client'

import { useState } from 'react'
import {
  Search, BedDouble, Calendar, CreditCard,
  CheckCircle2, Clock, XCircle, Phone, Download,
} from 'lucide-react'

interface Tenant {
  slug:       string
  name:       string
  logoUrl:    string | null
  brandColor: string
  phone:      string | null
}

interface BookingResult {
  id:             string
  booking_ref:    string
  status:         string
  payment_status: string
  check_in_date:  string
  check_out_date: string
  final_amount:   number
  paid_amount:    number
  semester:       string | null
  academic_year:  string | null
  notes:          string | null
  created_at:     string
  room:           { room_number: string; block: string | null; floor: number | null; category: { name: string; type: string } | { name: string; type: string }[] | null } | { room_number: string; block: string | null; floor: number | null; category: { name: string; type: string } | { name: string; type: string }[] | null }[] | null
  occupant:       { first_name: string; last_name: string; phone: string; email: string | null; institution: string | null; student_id: string | null } | { first_name: string; last_name: string; phone: string; email: string | null; institution: string | null; student_id: string | null }[] | null
  booking_payments: { id: string; amount: number; method: string; reference: string | null; status: string; paid_at: string | null }[]
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending_payment: { label: 'Pending Payment', icon: <Clock className="h-4 w-4" />,         color: '#d97706' },
  confirmed:       { label: 'Confirmed',       icon: <CheckCircle2 className="h-4 w-4" />,   color: '#2563eb' },
  checked_in:      { label: 'Checked In',      icon: <BedDouble className="h-4 w-4" />,      color: '#16a34a' },
  checked_out:     { label: 'Checked Out',     icon: <CheckCircle2 className="h-4 w-4" />,   color: '#6b7280' },
  cancelled:       { label: 'Cancelled',       icon: <XCircle className="h-4 w-4" />,        color: '#dc2626' },
  no_show:         { label: 'No Show',         icon: <XCircle className="h-4 w-4" />,        color: '#dc2626' },
}

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  unpaid:   { label: 'Unpaid',   color: '#dc2626' },
  partial:  { label: 'Partial',  color: '#d97706' },
  paid:     { label: 'Paid',     color: '#16a34a' },
  refunded: { label: 'Refunded', color: '#6b7280' },
}

const METHOD_LABELS: Record<string, string> = {
  momo_mtn:        'MTN MoMo',
  momo_vodafone:   'Vodafone Cash',
  momo_airteltigo: 'AirtelTigo Money',
  cash:            'Cash',
  bank_transfer:   'Bank Transfer',
  card:            'Card',
  cheque:          'Cheque',
}

function formatGHS(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))
}

export function OccupantPortal({ tenant }: { tenant: Tenant }) {
  const [ref,     setRef]     = useState('')
  const [phone,   setPhone]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [result,  setResult]  = useState<BookingResult | null>(null)

  async function lookup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`/api/public/${tenant.slug}/portal`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ booking_ref: ref.trim(), phone: phone.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Lookup failed')
      setResult(data.booking)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  const room     = result ? (Array.isArray(result.room)     ? result.room[0]     : result.room)     : null
  const occupant = result ? (Array.isArray(result.occupant) ? result.occupant[0] : result.occupant) : null
  const cat      = room   ? (Array.isArray(room.category)   ? room.category[0]   : room.category)   : null
  const payments = result?.booking_payments ?? []
  const balance  = result ? result.final_amount - result.paid_amount : 0

  const statusCfg  = result ? (STATUS_CONFIG[result.status]           ?? null) : null
  const paymentCfg = result ? (PAYMENT_STATUS[result.payment_status]  ?? null) : null

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <header style={{ background: `linear-gradient(135deg, ${tenant.brandColor} 0%, ${tenant.brandColor}CC 100%)` }}>
        <div className="mx-auto max-w-2xl px-4 py-8 text-white">
          <div className="flex items-center gap-3">
            {tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logoUrl} alt={tenant.name} className="h-10 w-10 rounded-lg object-cover bg-white/20 p-0.5" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 font-bold text-lg">
                {tenant.name[0]}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold">{tenant.name}</h1>
              <p className="text-sm text-white/70">Booking Portal</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Lookup form */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Check your booking</h2>
          <p className="text-sm text-gray-500 mb-5">Enter your booking reference and the phone number used when booking.</p>

          <form onSubmit={lookup} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Booking reference</label>
              <input
                value={ref}
                onChange={e => setRef(e.target.value.toUpperCase())}
                placeholder="e.g. BK-20250001"
                required
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                style={{ '--tw-ring-color': tenant.brandColor } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone number</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                type="tel"
                placeholder="0241234567"
                required
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: tenant.brandColor }}
            >
              <Search className="h-4 w-4" />
              {loading ? 'Looking up…' : 'Find my booking'}
            </button>
          </form>
        </div>

        {/* Result */}
        {result && (
          <div className="space-y-4">
            {/* Status banner */}
            <div
              className="rounded-2xl p-5 text-white"
              style={{ backgroundColor: statusCfg?.color ?? '#6b7280' }}
            >
              <div className="flex items-center gap-2 mb-2">
                {statusCfg?.icon}
                <span className="text-sm font-medium">{statusCfg?.label ?? result.status}</span>
              </div>
              <p className="text-2xl font-bold">{result.booking_ref}</p>
              {occupant && (
                <p className="mt-1 text-white/80 text-sm">
                  {occupant.first_name} {occupant.last_name}
                </p>
              )}
            </div>

            {/* Booking details */}
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm divide-y divide-gray-100">
              <div className="p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Room</h3>
                {room ? (
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                      <BedDouble className="h-4 w-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Room {room.room_number}
                        {room.block ? `, Block ${room.block}` : ''}
                        {room.floor != null ? `, Floor ${room.floor}` : ''}
                      </p>
                      {cat && <p className="text-xs text-gray-500 mt-0.5 capitalize">{cat.name} · {cat.type}</p>}
                    </div>
                  </div>
                ) : <p className="text-sm text-gray-500">—</p>}
              </div>

              <div className="p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Stay dates</h3>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-700">
                    {formatDate(result.check_in_date)} → {formatDate(result.check_out_date)}
                  </span>
                </div>
                {result.semester && (
                  <p className="mt-1.5 text-xs text-gray-500 pl-7">
                    {result.semester}{result.academic_year ? ` · ${result.academic_year}` : ''}
                  </p>
                )}
              </div>

              <div className="p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment</h3>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500">Status</span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: paymentCfg?.color ?? '#6b7280' }}
                  >
                    {paymentCfg?.label ?? result.payment_status}
                  </span>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total</span>
                    <span className="font-medium text-gray-900">{formatGHS(result.final_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Paid</span>
                    <span className="font-medium text-green-600">{formatGHS(result.paid_amount)}</span>
                  </div>
                  {balance > 0 && (
                    <div className="flex justify-between border-t border-gray-100 pt-1.5">
                      <span className="text-gray-700 font-medium">Balance due</span>
                      <span className="font-bold text-red-600">{formatGHS(balance)}</span>
                    </div>
                  )}
                </div>
              </div>

              {payments.length > 0 && (
                <div className="p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment history</h3>
                  <div className="space-y-2">
                    {payments.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-gray-700">{METHOD_LABELS[p.method] ?? p.method}</span>
                          {p.reference && (
                            <span className="text-xs text-gray-400 font-mono">{p.reference}</span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{formatGHS(p.amount)}</p>
                          {p.paid_at && <p className="text-xs text-gray-400">{formatDate(p.paid_at)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Download invoice */}
              <div className="p-5">
                <a
                  href={`/api/invoices/${result.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download invoice PDF
                </a>
              </div>
            </div>

            {/* Contact hostel */}
            {tenant.phone && balance > 0 && (
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                <p className="text-sm text-gray-600 mb-3">
                  Need to make a payment or have a question? Contact the hostel directly.
                </p>
                <a
                  href={`https://wa.me/${tenant.phone.replace(/\D/g, '').replace(/^0/, '233')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity"
                  style={{ backgroundColor: tenant.brandColor }}
                >
                  <Phone className="h-4 w-4" />
                  WhatsApp {tenant.phone}
                </a>
              </div>
            )}

            {/* Start new lookup */}
            <button
              onClick={() => { setResult(null); setRef(''); setPhone('') }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-2"
            >
              Look up a different booking
            </button>
          </div>
        )}
      </main>

      <footer className="py-8 text-center text-xs text-gray-400 border-t border-gray-100 mt-8">
        {tenant.name} · Powered by <span className="font-semibold">AbrempongHMS</span>
      </footer>
    </div>
  )
}
