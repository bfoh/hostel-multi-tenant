/**
 * Single source of truth for the payment methods staff can select when
 * recording a payment or charge — previously duplicated ad hoc across
 * record-payment-form.tsx, the payments API route, deposit-card.tsx,
 * booking-charges-card.tsx, and payment-plan-card.tsx (which had drifted:
 * it was missing 'cheque'). `bank_draft` (the payment_method enum's 8th DB
 * value) is deliberately excluded here — it's only ever produced by the
 * dedicated bank-draft submission/reconciliation flow, never chosen from a
 * generic method picker like this one.
 */
export const PAYMENT_METHODS = [
  'cash',
  'momo_mtn',
  'momo_vodafone',
  'momo_airteltigo',
  'card',
  'bank_transfer',
  'cheque',
] as const

export type PaymentMethod = typeof PAYMENT_METHODS[number]

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash:             'Cash',
  momo_mtn:         'MTN MoMo',
  momo_vodafone:    'Vodafone Cash',
  momo_airteltigo:  'AirtelTigo Money',
  card:             'Card',
  bank_transfer:    'Bank Transfer',
  cheque:           'Cheque',
}

export const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> =
  PAYMENT_METHODS.map((value) => ({ value, label: PAYMENT_METHOD_LABEL[value] }))
