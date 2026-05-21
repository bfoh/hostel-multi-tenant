'use client'

import { Loader2, CreditCard, Wallet } from 'lucide-react'

interface Props {
  amount:       number   // pesewas — used for button label
  loading:      boolean
  disabled?:    boolean
  brandColor:   string
  method:       'online' | 'cash_at_pickup'
  onMethodChange: (m: 'online' | 'cash_at_pickup') => void
  onSubmit:     () => void
  cashLabel?:   string   // override default "Pay cash at pickup"
}

function ghs(p: number) {
  return `GH₵ ${(p / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

export function WalkinPaymentActions({
  amount, loading, disabled, brandColor, method, onMethodChange, onSubmit, cashLabel,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onMethodChange('online')}
          disabled={loading}
          className={`flex items-start gap-2 rounded-xl border p-3 text-left transition-colors ${
            method === 'online' ? 'border-2 bg-white' : 'border-gray-200 bg-gray-50 hover:bg-white'
          }`}
          style={method === 'online' ? { borderColor: brandColor } : {}}
        >
          <CreditCard className="h-4 w-4 mt-0.5 shrink-0" style={{ color: brandColor }} />
          <div>
            <p className="text-xs font-semibold text-gray-900">Pay online now</p>
            <p className="mt-0.5 text-[10px] text-gray-500">MoMo · Card · Bank — via Paystack</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onMethodChange('cash_at_pickup')}
          disabled={loading}
          className={`flex items-start gap-2 rounded-xl border p-3 text-left transition-colors ${
            method === 'cash_at_pickup' ? 'border-2 bg-white' : 'border-gray-200 bg-gray-50 hover:bg-white'
          }`}
          style={method === 'cash_at_pickup' ? { borderColor: brandColor } : {}}
        >
          <Wallet className="h-4 w-4 mt-0.5 shrink-0" style={{ color: brandColor }} />
          <div>
            <p className="text-xs font-semibold text-gray-900">{cashLabel ?? 'Pay cash on pickup'}</p>
            <p className="mt-0.5 text-[10px] text-gray-500">Settle in person when you collect</p>
          </div>
        </button>
      </div>

      <button
        onClick={onSubmit}
        disabled={disabled || loading || amount <= 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: brandColor }}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading
          ? (method === 'online' ? 'Connecting to payment…' : 'Reserving…')
          : (method === 'online'
              ? `Pay ${ghs(amount)} now`
              : `Reserve ${ghs(amount)} — pay at pickup`)}
      </button>

      <p className="text-center text-[11px] text-gray-400">
        {method === 'online'
          ? 'Mobile Money · Card · Bank Transfer — all accepted through Paystack'
          : 'Your booking is held. Pay cash to staff on arrival.'}
      </p>
    </div>
  )
}
