'use client'

import { useState } from 'react'
import {
  Search, BedDouble, Calendar, CreditCard,
  CheckCircle2, Clock, XCircle, Phone, Download,
  Wrench, AlertCircle, Loader2, Plus, Bell, Star,
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

const MAINT_CATEGORIES = [
  { value: 'plumbing',     label: 'Plumbing' },
  { value: 'electrical',   label: 'Electrical' },
  { value: 'furniture',    label: 'Furniture' },
  { value: 'appliance',    label: 'Appliance' },
  { value: 'cleaning',     label: 'Cleaning' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'structural',   label: 'Structural' },
  { value: 'other',        label: 'Other' },
]

export function OccupantPortal({ tenant, payStatus }: { tenant: Tenant; payStatus?: 'success' | 'failed' | 'error' }) {
  const [ref,     setRef]     = useState('')
  const [phone,   setPhone]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [result,  setResult]  = useState<BookingResult | null>(null)
  const [activeTab, setActiveTab] = useState<'booking' | 'maintenance' | 'notices' | 'feedback'>('booking')
  const [notices, setNotices]     = useState<{ id: string; title: string; body: string; category: string; is_pinned: boolean; published_at: string }[] | null>(null)
  const [noticesLoading, setNoticesLoading] = useState(false)

  // Pay-now state
  const [payAmount,   setPayAmount]   = useState('')
  const [payLoading,  setPayLoading]  = useState(false)
  const [payError,    setPayError]    = useState<string | null>(null)

  async function startPayment(e: React.FormEvent) {
    e.preventDefault()
    setPayLoading(true); setPayError(null)
    try {
      const res = await fetch(`/api/public/${tenant.slug}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_ref: ref.trim(),
          phone:       phone.trim(),
          amount:      Math.round(parseFloat(payAmount) * 100),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Payment init failed')
      window.location.href = data.authorization_url
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setPayLoading(false)
    }
  }

  // Feedback state
  const [fbRating,     setFbRating]     = useState(5)
  const [fbClean,      setFbClean]      = useState(5)
  const [fbStaff,      setFbStaff]      = useState(5)
  const [fbValue,      setFbValue]      = useState(5)
  const [fbRecommend,  setFbRecommend]  = useState(true)
  const [fbComments,   setFbComments]   = useState('')
  const [fbSending,    setFbSending]    = useState(false)
  const [fbSuccess,    setFbSuccess]    = useState(false)
  const [fbError,      setFbError]      = useState<string | null>(null)

  async function submitFeedback(e: React.FormEvent) {
    e.preventDefault()
    setFbSending(true); setFbError(null)
    try {
      const res = await fetch(`/api/public/${tenant.slug}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_ref:        ref.trim(),
          phone:              phone.trim(),
          overall_rating:     fbRating,
          cleanliness_rating: fbClean,
          staff_rating:       fbStaff,
          value_rating:       fbValue,
          would_recommend:    fbRecommend,
          comments:           fbComments || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setFbSuccess(true)
    } catch (err) {
      setFbError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setFbSending(false)
    }
  }

  async function loadNotices() {
    if (notices !== null) return
    setNoticesLoading(true)
    try {
      const res = await fetch(`/api/public/${tenant.slug}/notices`)
      if (res.ok) setNotices(await res.json())
    } finally {
      setNoticesLoading(false)
    }
  }

  // Maintenance form state
  const [mTitle,    setMTitle]    = useState('')
  const [mCat,      setMCat]      = useState('plumbing')
  const [mPriority, setMPriority] = useState('medium')
  const [mDesc,     setMDesc]     = useState('')
  const [mSending,  setMSending]  = useState(false)
  const [mError,    setMError]    = useState<string | null>(null)
  const [mSuccess,  setMSuccess]  = useState(false)

  async function submitMaintenance(e: React.FormEvent) {
    e.preventDefault()
    setMSending(true)
    setMError(null)
    setMSuccess(false)
    try {
      const res = await fetch(`/api/public/${tenant.slug}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_ref: ref.trim(),
          phone: phone.trim(),
          title: mTitle,
          category: mCat,
          priority: mPriority,
          description: mDesc || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setMSuccess(true)
      setMTitle('')
      setMDesc('')
    } catch (err) {
      setMError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setMSending(false)
    }
  }

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
        {/* Paystack return banner */}
        {payStatus === 'success' && (
          <div className="rounded-2xl bg-green-50 border border-green-200 px-5 py-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Payment successful!</p>
              <p className="text-xs text-green-700">Look up your booking below to see your updated balance.</p>
            </div>
          </div>
        )}
        {(payStatus === 'failed' || payStatus === 'error') && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">Payment was not completed. Please try again.</p>
          </div>
        )}

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

              {/* Pay online */}
              {balance > 0 && (
                <div className="p-5 border-t border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Pay online</h3>
                  <form onSubmit={startPayment} className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Amount (GHS)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        max={(balance / 100).toFixed(2)}
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        placeholder={(balance / 100).toFixed(2)}
                        required
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={payLoading}
                      className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-opacity whitespace-nowrap"
                      style={{ backgroundColor: tenant.brandColor }}
                    >
                      {payLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {payLoading ? 'Redirecting…' : 'Pay with card'}
                    </button>
                  </form>
                  {payError && (
                    <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />{payError}
                    </p>
                  )}
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

            {/* Tab bar */}
            <div className="flex gap-1 rounded-2xl bg-white border border-gray-100 shadow-sm p-1">
              {([
                { id: 'booking',     icon: BedDouble, label: 'My Booking' },
                { id: 'maintenance', icon: Wrench,    label: 'Report Issue' },
                { id: 'notices',     icon: Bell,      label: 'Notices' },
              { id: 'feedback',    icon: Star,      label: 'Rate Stay' },
              ] as const).map((tab) => {
                if (tab.id === 'feedback' && result?.status !== 'checked_out') return null
                return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any)
                    if (tab.id === 'notices') loadNotices()
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-colors ${
                    activeTab === tab.id ? 'text-white' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={activeTab === tab.id ? { backgroundColor: tenant.brandColor } : {}}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
                )
              })}
            </div>

            {/* Maintenance request form */}
            {activeTab === 'maintenance' && (
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">Report a maintenance issue</h3>

                {mSuccess && (
                  <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Request submitted! Staff will attend to it soon.
                  </div>
                )}

                <form onSubmit={submitMaintenance} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Issue title *</label>
                    <input
                      value={mTitle}
                      onChange={(e) => setMTitle(e.target.value)}
                      required
                      placeholder="e.g. Tap is leaking"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                      <select
                        value={mCat}
                        onChange={(e) => setMCat(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2"
                      >
                        {MAINT_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Urgency</label>
                      <select
                        value={mPriority}
                        onChange={(e) => setMPriority(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                    <textarea
                      value={mDesc}
                      onChange={(e) => setMDesc(e.target.value)}
                      rows={3}
                      placeholder="Describe the issue in detail…"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 resize-none transition-all"
                    />
                  </div>
                  {mError && (
                    <p className="rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />{mError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={mSending}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
                    style={{ backgroundColor: tenant.brandColor }}
                  >
                    {mSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {mSending ? 'Submitting…' : 'Submit request'}
                  </button>
                </form>
              </div>
            )}

            {/* Notices tab */}
            {activeTab === 'notices' && (
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Notice Board</h3>
                {noticesLoading && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                )}
                {!noticesLoading && (notices === null || notices.length === 0) && (
                  <p className="py-6 text-center text-sm text-gray-400">No notices at this time</p>
                )}
                {!noticesLoading && notices && notices.length > 0 && (
                  <div className="space-y-3">
                    {notices.map((n) => (
                      <div key={n.id}
                        className={`rounded-xl border p-4 ${n.category === 'urgent' ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-semibold ${n.category === 'urgent' ? 'text-red-700' : 'text-gray-900'}`}>
                            {n.is_pinned ? '📌 ' : ''}{n.title}
                          </p>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                            n.category === 'urgent' ? 'bg-red-100 text-red-700'
                            : n.category === 'payment' ? 'bg-blue-100 text-blue-700'
                            : n.category === 'event' ? 'bg-green-100 text-green-700'
                            : 'bg-gray-200 text-gray-600'
                          }`}>{n.category}</span>
                        </div>
                        <p className="mt-1.5 text-sm text-gray-600 whitespace-pre-wrap">{n.body}</p>
                        <p className="mt-2 text-xs text-gray-400">
                          {new Date(n.published_at).toLocaleDateString('en-GH', { dateStyle: 'medium' })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Feedback tab */}
            {activeTab === 'feedback' && (
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">Rate your stay</h3>
                {fbSuccess ? (
                  <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-4 text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-green-700">Thank you for your feedback!</p>
                    <p className="text-xs text-green-600 mt-1">Your review helps us improve.</p>
                  </div>
                ) : (
                  <form onSubmit={submitFeedback} className="space-y-4">
                    {([
                      { label: 'Overall experience', state: fbRating,  set: setFbRating },
                      { label: 'Cleanliness',        state: fbClean,   set: setFbClean },
                      { label: 'Staff',              state: fbStaff,   set: setFbStaff },
                      { label: 'Value for money',    state: fbValue,   set: setFbValue },
                    ] as const).map(({ label, state, set }) => (
                      <div key={label}>
                        <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
                        <div className="flex gap-2">
                          {[1,2,3,4,5].map((n) => (
                            <button key={n} type="button" onClick={() => (set as any)(n)}
                              className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold transition-colors ${
                                n <= state ? 'text-white' : 'border border-gray-200 text-gray-400'
                              }`}
                              style={n <= state ? { backgroundColor: tenant.brandColor } : {}}>
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Would you recommend us?</p>
                      <div className="flex gap-2">
                        {[true, false].map((v) => (
                          <button key={String(v)} type="button" onClick={() => setFbRecommend(v)}
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                              fbRecommend === v ? 'text-white' : 'border border-gray-200 text-gray-500'
                            }`}
                            style={fbRecommend === v ? { backgroundColor: tenant.brandColor } : {}}>
                            {v ? 'Yes' : 'No'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Comments (optional)</p>
                      <textarea value={fbComments} onChange={(e) => setFbComments(e.target.value)}
                        rows={3} placeholder="Tell us about your experience…"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 resize-none" />
                    </div>
                    {fbError && (
                      <p className="rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />{fbError}
                      </p>
                    )}
                    <button type="submit" disabled={fbSending}
                      className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
                      style={{ backgroundColor: tenant.brandColor }}>
                      {fbSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                      {fbSending ? 'Submitting…' : 'Submit feedback'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Start new lookup */}
            <button
              onClick={() => { setResult(null); setRef(''); setPhone(''); setActiveTab('booking') }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-2"
            >
              Look up a different booking
            </button>
          </div>
        )}
      </main>

      <footer className="py-8 text-center text-xs text-gray-400 border-t border-gray-100 mt-8">
        {tenant.name} · Powered by <span className="font-semibold">GH Hostels</span>
      </footer>
    </div>
  )
}
