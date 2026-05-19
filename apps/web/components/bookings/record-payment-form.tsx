'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Smartphone, ClipboardList, CheckCircle2, Link2, Copy, Building2 } from 'lucide-react'
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

/* ─────────────────────────── Pay link form ─────────────────────── */

const payLinkSchema = z.object({
  amount:   z.coerce.number().min(0.01, 'Enter an amount'),
  email:    z.string().email('Enter occupant email for Paystack receipt').or(z.literal('')).optional(),
  send_sms: z.boolean().optional(),
})
type PayLinkValues = z.infer<typeof payLinkSchema>

interface Props {
  bookingId: string
  balance:   number   // pesewas
  paystackEnabled?: boolean
}

type Tab = 'manual' | 'momo' | 'paylink' | 'nuban'

const nubanSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Enter an amount'),
  email:  z.string().email('Enter occupant email for Paystack receipt').or(z.literal('')).optional(),
})
type NubanValues = z.infer<typeof nubanSchema>

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

  /* ── Pay link ── */
  const [payLinkUrl, setPayLinkUrl] = useState<string | null>(null)
  const [payLinkError, setPayLinkError] = useState<string | null>(null)
  const [payLinkLoading, setPayLinkLoading] = useState(false)
  const [payLinkCopied, setPayLinkCopied] = useState(false)
  const [payLinkSmsSent, setPayLinkSmsSent] = useState(false)

  const payLink = useForm<PayLinkValues>({
    resolver: zodResolver(payLinkSchema),
    defaultValues: { amount: balance / 100, send_sms: true },
  })

  async function submitPayLink(values: PayLinkValues) {
    setPayLinkError(null)
    setPayLinkLoading(true)
    setPayLinkSmsSent(false)
    try {
      const res = await fetch('/api/payments/paystack/pay-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId,
          amount:     Math.round(values.amount * 100),
          email:      values.email ? values.email : null,
          send_sms:   !!values.send_sms,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPayLinkError(typeof data.error === 'string' ? data.error : 'Failed to create link.')
        return
      }
      setPayLinkUrl(data.authorization_url)
      if (values.send_sms) setPayLinkSmsSent(true)
    } finally {
      setPayLinkLoading(false)
    }
  }

  async function copyPayLink() {
    if (!payLinkUrl) return
    try {
      await navigator.clipboard.writeText(payLinkUrl)
      setPayLinkCopied(true)
      setTimeout(() => setPayLinkCopied(false), 2000)
    } catch { /* clipboard may be unavailable */ }
  }

  function resetPayLink() {
    setPayLinkUrl(null)
    setPayLinkError(null)
    setPayLinkSmsSent(false)
    payLink.reset({ amount: balance / 100, send_sms: true, email: '' })
  }

  /* ── Bank transfer NUBAN ── */
  type NubanStage = 'form' | 'awaiting' | 'success' | 'expired' | 'failed'
  const [nubanStage, setNubanStage] = useState<NubanStage>('form')
  const [nubanError, setNubanError] = useState<string | null>(null)
  const [nubanLoading, setNubanLoading] = useState(false)
  const [nubanPaymentId, setNubanPaymentId] = useState<string | null>(null)
  const [nubanDetails, setNubanDetails] = useState<{
    account_number: string | null
    account_name:   string | null
    bank_name:      string | null
    amount:         number
    expires_at:     string
  } | null>(null)
  const [nubanCopied, setNubanCopied] = useState<'acc' | 'amt' | null>(null)
  const [nubanCountdown, setNubanCountdown] = useState<string>('')

  const nubanForm = useForm<NubanValues>({
    resolver: zodResolver(nubanSchema),
    defaultValues: { amount: balance / 100 },
  })

  // Tick countdown + poll payment status
  useEffect(() => {
    if (nubanStage !== 'awaiting' || !nubanDetails || !nubanPaymentId) return

    const expiry = new Date(nubanDetails.expires_at).getTime()
    const interval = setInterval(async () => {
      const remaining = expiry - Date.now()
      if (remaining <= 0) {
        setNubanCountdown('00:00')
        setNubanStage('expired')
        return
      }
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      setNubanCountdown(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)

      try {
        const res = await fetch('/api/payments/paystack/verify', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ payment_id: nubanPaymentId }),
        })
        const data = await res.json().catch(() => ({}))
        if (data.status === 'success') {
          setNubanStage('success')
          router.refresh()
        }
      } catch { /* keep polling */ }
    }, 4000)

    return () => clearInterval(interval)
  }, [nubanStage, nubanDetails, nubanPaymentId, router])

  async function submitNuban(values: NubanValues) {
    setNubanError(null); setNubanLoading(true)
    try {
      const res = await fetch('/api/payments/paystack/bank-transfer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          booking_id: bookingId,
          amount:     Math.round(values.amount * 100),
          email:      values.email || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNubanError(typeof data.error === 'string' ? data.error : 'Failed to generate NUBAN.')
        return
      }
      setNubanPaymentId(data.payment_id)
      setNubanDetails({
        account_number: data.account_number,
        account_name:   data.account_name,
        bank_name:      data.bank_name,
        amount:         data.amount,
        expires_at:     data.expires_at,
      })
      setNubanStage('awaiting')
    } finally {
      setNubanLoading(false)
    }
  }

  async function copyNuban(kind: 'acc' | 'amt') {
    if (!nubanDetails) return
    const text = kind === 'acc'
      ? (nubanDetails.account_number ?? '')
      : ((nubanDetails.amount / 100).toFixed(2))
    try {
      await navigator.clipboard.writeText(text)
      setNubanCopied(kind)
      setTimeout(() => setNubanCopied(null), 2000)
    } catch { /* clipboard unavailable */ }
  }

  function resetNuban() {
    setNubanStage('form'); setNubanError(null); setNubanDetails(null)
    setNubanPaymentId(null); setNubanCountdown('')
    nubanForm.reset({ amount: balance / 100, email: '' })
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

      {/* Tab switcher — only show online tabs if Paystack is configured */}
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
            MoMo prompt
          </button>
          <button
            type="button"
            onClick={() => { setTab('paylink'); resetPayLink() }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
              tab === 'paylink' ? 'bg-surface shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            Pay link
          </button>
          <button
            type="button"
            onClick={() => { setTab('nuban'); resetNuban() }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
              tab === 'nuban' ? 'bg-surface shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            Bank transfer
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

      {/* ── Pay link tab ── */}
      {tab === 'paylink' && (
        <div className="space-y-3">
          {!payLinkUrl && (
            <form onSubmit={payLink.handleSubmit(submitPayLink)} className="space-y-3" noValidate>
              <p className="text-[11px] text-text-tertiary">
                Generates a Paystack hosted page. Guest can pay with Mobile Money, Card or Bank Transfer.
                Payment auto-records on success.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Amount (GH₵)</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-tertiary">GH₵</span>
                  <input type="number" min={0.01} step={0.01} {...payLink.register('amount')} className="input-base pl-10 font-mono text-sm" />
                </div>
                {payLink.formState.errors.amount && <p className="text-[11px] text-danger">{payLink.formState.errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Occupant email (optional)</label>
                <input type="email" placeholder="For Paystack receipt" {...payLink.register('email')} className="input-base text-sm" />
                {payLink.formState.errors.email && <p className="text-[11px] text-danger">{payLink.formState.errors.email.message}</p>}
              </div>
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input type="checkbox" {...payLink.register('send_sms')} className="h-3.5 w-3.5" />
                Send link to occupant by SMS
              </label>
              {payLinkError && <div className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger">{payLinkError}</div>}
              <button
                type="submit"
                disabled={payLinkLoading}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-50"
              >
                {payLinkLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {payLinkLoading ? 'Generating link…' : 'Generate pay link'}
              </button>
            </form>
          )}

          {payLinkUrl && (
            <div className="space-y-3">
              <div className="rounded-lg border border-success/30 bg-success-subtle px-3 py-2 text-xs text-success">
                Pay link ready{payLinkSmsSent ? ' · SMS sent to occupant' : ''}.
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Share this link with the guest</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={payLinkUrl}
                    className="input-base flex-1 text-xs font-mono"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={copyPayLink}
                    className="flex items-center gap-1 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface-sunken transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {payLinkCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={payLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-md border border-border bg-surface-raised px-3 py-2 text-center text-xs font-medium text-text-primary hover:bg-surface-sunken transition-colors"
                >
                  Open in new tab
                </a>
                <button
                  type="button"
                  onClick={resetPayLink}
                  className="flex-1 rounded-md border border-border px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface-raised transition-colors"
                >
                  New link
                </button>
              </div>
              <p className="text-[11px] text-text-tertiary">
                Payment will record automatically once the guest pays.
                Refresh this page after confirming receipt.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Bank transfer (NUBAN) tab ── */}
      {tab === 'nuban' && (
        <div className="space-y-3">
          {nubanStage === 'form' && (
            <form onSubmit={nubanForm.handleSubmit(submitNuban)} className="space-y-3" noValidate>
              <p className="text-[11px] text-text-tertiary">
                Generates a unique Paystack NUBAN. Guest transfers from any Ghana bank app to that account number.
                Payment auto-records on settlement.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Amount (GH₵)</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-tertiary">GH₵</span>
                  <input type="number" min={0.01} step={0.01} {...nubanForm.register('amount')} className="input-base pl-10 font-mono text-sm" />
                </div>
                {nubanForm.formState.errors.amount && <p className="text-[11px] text-danger">{nubanForm.formState.errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Occupant email (optional)</label>
                <input type="email" placeholder="For Paystack receipt" {...nubanForm.register('email')} className="input-base text-sm" />
              </div>
              {nubanError && <div className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger">{nubanError}</div>}
              <button
                type="submit"
                disabled={nubanLoading}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-50"
              >
                {nubanLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {nubanLoading ? 'Generating NUBAN…' : 'Get bank account'}
              </button>
            </form>
          )}

          {nubanStage === 'awaiting' && nubanDetails && (
            <div className="space-y-3">
              <div className="rounded-lg border border-info/20 bg-info-subtle px-3 py-2 text-xs text-info">
                Transfer the exact amount below within {nubanCountdown}. We&apos;ll auto-confirm on receipt.
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-surface-raised p-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-text-tertiary">Bank</p>
                  <p className="text-sm font-medium text-text-primary">{nubanDetails.bank_name ?? 'See instructions'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-text-tertiary">Account name</p>
                  <p className="text-sm font-medium text-text-primary">{nubanDetails.account_name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-text-tertiary">Account number</p>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-mono font-bold text-text-primary tracking-wider">
                      {nubanDetails.account_number ?? '—'}
                    </p>
                    {nubanDetails.account_number && (
                      <button
                        type="button"
                        onClick={() => copyNuban('acc')}
                        className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium"
                      >
                        <Copy className="h-3 w-3" />
                        {nubanCopied === 'acc' ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-text-tertiary">Amount</p>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-mono font-bold text-text-primary">
                      {formatGHS(nubanDetails.amount)}
                    </p>
                    <button
                      type="button"
                      onClick={() => copyNuban('amt')}
                      className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium"
                    >
                      <Copy className="h-3 w-3" />
                      {nubanCopied === 'amt' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-text-secondary">
                <Loader2 className="h-3 w-3 animate-spin" />
                Waiting for transfer · expires in {nubanCountdown}
              </div>

              <button
                type="button"
                onClick={resetNuban}
                className="w-full rounded-md border border-border px-4 py-2 text-xs font-medium text-text-secondary hover:bg-surface-raised transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {nubanStage === 'success' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <p className="font-semibold text-success">Bank transfer confirmed!</p>
              <p className="text-xs text-text-secondary">The booking has been updated automatically.</p>
              <button
                onClick={resetNuban}
                className="mt-2 rounded-md border border-border px-4 py-2 text-xs font-medium text-text-primary hover:bg-surface-raised transition-colors"
              >
                Take another payment
              </button>
            </div>
          )}

          {nubanStage === 'expired' && (
            <div className="space-y-3">
              <div className="rounded-md bg-warning-subtle px-3 py-2 text-xs text-warning-fg">
                NUBAN expired before transfer was received. Generate a new one or check with the guest.
              </div>
              <button
                onClick={resetNuban}
                className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
              >
                Generate new NUBAN
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
