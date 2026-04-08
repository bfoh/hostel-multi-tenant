'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Smartphone, ClipboardList, CheckCircle2 } from 'lucide-react'
import { formatGHS } from '@/lib/utils'

/* ─────────────────────────── Manual form ────────────────────────── */

const manualSchema = z.object({
  amount:    z.coerce.number().min(0.01, 'Enter an amount'),
  method:    z.enum(['momo_mtn', 'momo_vodafone', 'momo_airteltigo', 'card', 'bank_transfer', 'cash', 'cheque']),
  reference: z.string().max(100).optional(),
  notes:     z.string().max(300).optional(),
})
type ManualValues = z.infer<typeof manualSchema>

/* ─────────────────────────── MoMo form ─────────────────────────── */

const momoSchema = z.object({
  amount:   z.coerce.number().min(0.01, 'Enter an amount'),
  phone:    z.string().min(9, 'Enter a valid phone number').max(15),
  provider: z.enum(['mtn', 'vod', 'atl']),
  email:    z.string().email('Enter occupant email for Paystack receipt'),
})
type MoMoValues = z.infer<typeof momoSchema>

const PROVIDER_LABEL = { mtn: 'MTN MoMo', vod: 'Vodafone Cash', atl: 'AirtelTigo Money' }

/* ─────────────────────────── Component ─────────────────────────── */

interface Props {
  bookingId: string
  balance:   number   // pesewas
  paystackEnabled?: boolean
}

type Tab = 'manual' | 'momo'

export function RecordPaymentForm({ bookingId, balance, paystackEnabled = false }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('manual')

  /* ── Manual ── */
  const [manualError, setManualError] = useState<string | null>(null)
  const [manualSuccess, setManualSuccess] = useState(false)

  const manual = useForm<ManualValues>({
    resolver: zodResolver(manualSchema),
    defaultValues: { method: 'momo_mtn', amount: balance / 100 },
  })

  async function submitManual(values: ManualValues) {
    setManualError(null)
    const res = await fetch(`/api/bookings/${bookingId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, amount: Math.round(values.amount * 100) }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setManualError(d.error ?? 'Recording failed.')
      return
    }
    setManualSuccess(true)
    manual.reset()
    router.refresh()
    setTimeout(() => setManualSuccess(false), 3000)
  }

  /* ── MoMo via Paystack ── */
  type MoMoStage = 'form' | 'otp' | 'waiting' | 'success' | 'failed'
  const [momoStage, setMomoStage] = useState<MoMoStage>('form')
  const [momoMessage, setMomoMessage] = useState('')
  const [momoPaymentId, setMomoPaymentId] = useState<string | null>(null)
  const [momoRef, setMomoRef] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [momoError, setMomoError] = useState<string | null>(null)
  const [momoLoading, setMomoLoading] = useState(false)

  const momo = useForm<MoMoValues>({
    resolver: zodResolver(momoSchema),
    defaultValues: { provider: 'mtn', amount: balance / 100 },
  })

  async function submitMoMo(values: MoMoValues) {
    setMomoError(null)
    setMomoLoading(true)
    const res = await fetch('/api/payments/paystack/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_id: bookingId,
        amount:     Math.round(values.amount * 100),
        phone:      values.phone,
        provider:   values.provider,
        email:      values.email,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setMomoLoading(false)

    if (!res.ok) {
      setMomoError(data.error ?? 'Failed to initiate payment.')
      return
    }

    setMomoPaymentId(data.payment_id)
    setMomoRef(data.reference)
    setMomoMessage(data.display_text ?? 'Check your phone to approve the payment.')

    if (data.status === 'send_otp') {
      setMomoStage('otp')
    } else {
      setMomoStage('waiting')
      pollForSuccess(data.payment_id)
    }
  }

  async function submitMoMoOtp() {
    if (!momoRef || !otp) return
    setMomoLoading(true)
    setMomoError(null)
    const res = await fetch('/api/payments/paystack/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: momoRef, otp }),
    })
    const data = await res.json().catch(() => ({}))
    setMomoLoading(false)

    if (!res.ok) {
      setMomoError(data.error ?? 'OTP failed.')
      return
    }

    setMomoMessage(data.display_text ?? 'Processing…')
    setMomoStage('waiting')
    if (momoPaymentId) pollForSuccess(momoPaymentId)
  }

  async function pollForSuccess(paymentId: string) {
    let attempts = 0
    const maxAttempts = 12  // poll for up to 60s

    const poll = async () => {
      attempts++
      const res = await fetch('/api/payments/paystack/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: paymentId }),
      })
      const data = await res.json().catch(() => ({}))

      if (data.status === 'success') {
        setMomoStage('success')
        router.refresh()
        return
      }

      if (data.status === 'failed' || attempts >= maxAttempts) {
        setMomoStage('failed')
        setMomoError('Payment was not confirmed. Please check with the occupant and record manually if needed.')
        return
      }

      setTimeout(poll, 5000)
    }

    setTimeout(poll, 5000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-primary">Record Payment</p>
        <p className="text-xs text-text-tertiary">
          Balance: <span className="font-semibold text-danger">{formatGHS(balance)}</span>
        </p>
      </div>

      {/* Tab switcher — only show MoMo tab if Paystack is configured */}
      {paystackEnabled && (
        <div className="flex gap-1 rounded-lg border border-border bg-surface-sunken p-1">
          <button
            type="button"
            onClick={() => setTab('manual')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
              tab === 'manual' ? 'bg-surface shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Manual
          </button>
          <button
            type="button"
            onClick={() => { setTab('momo'); setMomoStage('form'); setMomoError(null) }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
              tab === 'momo' ? 'bg-surface shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            MoMo via Paystack
          </button>
        </div>
      )}

      {/* ── Manual tab ── */}
      {tab === 'manual' && (
        <form onSubmit={manual.handleSubmit(submitManual)} className="space-y-3" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Amount (GH₵)</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-tertiary">GH₵</span>
                <input type="number" min={0.01} step={0.01} {...manual.register('amount')} className="input-base pl-10 font-mono text-sm" />
              </div>
              {manual.formState.errors.amount && <p className="text-[11px] text-danger">{manual.formState.errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Method</label>
              <select {...manual.register('method')} className="input-base text-sm">
                <option value="momo_mtn">MTN MoMo</option>
                <option value="momo_vodafone">Vodafone Cash</option>
                <option value="momo_airteltigo">AirtelTigo Money</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Card</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Reference (optional)</label>
            <input type="text" placeholder="MoMo ref, bank ref…" {...manual.register('reference')} className="input-base text-sm" />
          </div>
          {manualError   && <div className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger">{manualError}</div>}
          {manualSuccess && <div className="rounded-md bg-success-subtle px-3 py-2 text-xs text-success">Payment recorded successfully.</div>}
          <button
            type="submit"
            disabled={manual.formState.isSubmitting}
            className="w-full rounded-md bg-success px-4 py-2.5 text-sm font-semibold text-success-fg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {manual.formState.isSubmitting ? 'Recording…' : 'Record Payment'}
          </button>
        </form>
      )}

      {/* ── MoMo via Paystack tab ── */}
      {tab === 'momo' && (
        <div className="space-y-3">
          {/* Form stage */}
          {momoStage === 'form' && (
            <form onSubmit={momo.handleSubmit(submitMoMo)} className="space-y-3" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Amount (GH₵)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-tertiary">GH₵</span>
                    <input type="number" min={0.01} step={0.01} {...momo.register('amount')} className="input-base pl-10 font-mono text-sm" />
                  </div>
                  {momo.formState.errors.amount && <p className="text-[11px] text-danger">{momo.formState.errors.amount.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Network</label>
                  <select {...momo.register('provider')} className="input-base text-sm">
                    <option value="mtn">MTN MoMo</option>
                    <option value="vod">Vodafone Cash</option>
                    <option value="atl">AirtelTigo Money</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Occupant MoMo number</label>
                <input type="tel" placeholder="0244 000 000" {...momo.register('phone')} className="input-base text-sm" />
                {momo.formState.errors.phone && <p className="text-[11px] text-danger">{momo.formState.errors.phone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Occupant email</label>
                <input type="email" placeholder="For Paystack receipt" {...momo.register('email')} className="input-base text-sm" />
                {momo.formState.errors.email && <p className="text-[11px] text-danger">{momo.formState.errors.email.message}</p>}
              </div>
              {momoError && <div className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger">{momoError}</div>}
              <button
                type="submit"
                disabled={momoLoading}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-50"
              >
                {momoLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {momoLoading ? 'Sending request…' : 'Send MoMo request'}
              </button>
            </form>
          )}

          {/* OTP stage */}
          {momoStage === 'otp' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-info/20 bg-info-subtle px-4 py-3 text-sm text-info">{momoMessage}</div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Enter OTP from your phone</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  className="input-base font-mono tracking-widest text-center text-lg"
                />
              </div>
              {momoError && <div className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger">{momoError}</div>}
              <button
                onClick={submitMoMoOtp}
                disabled={momoLoading || otp.length < 4}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg disabled:opacity-50"
              >
                {momoLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {momoLoading ? 'Verifying…' : 'Submit OTP'}
              </button>
            </div>
          )}

          {/* Waiting stage */}
          {momoStage === 'waiting' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
              <p className="font-medium text-text-primary">Waiting for approval…</p>
              <p className="text-xs text-text-secondary max-w-xs">{momoMessage}</p>
            </div>
          )}

          {/* Success stage */}
          {momoStage === 'success' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <p className="font-semibold text-success">Payment confirmed!</p>
              <p className="text-xs text-text-secondary">The booking has been updated automatically.</p>
            </div>
          )}

          {/* Failed stage */}
          {momoStage === 'failed' && (
            <div className="space-y-3">
              {momoError && <div className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger">{momoError}</div>}
              <button
                onClick={() => { setMomoStage('form'); setMomoError(null) }}
                className="w-full rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
