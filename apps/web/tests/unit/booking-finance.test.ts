import { describe, expect, it } from 'vitest'

import { calculateInvoiceFinancials } from '@/lib/data/booking-finance'

describe('canonical invoice arithmetic', () => {
  it('includes folio charges and only credits paid charges as received', () => {
    expect(calculateInvoiceFinancials({
      final_amount: 650_000,
      paid_amount: 400_000,
      booking_charges: [
        { amount: 50_000, paid: true },
        { amount: 25_000, paid: false },
      ],
    })).toMatchObject({
      invoiceTotal: 725_000,
      invoiceReceived: 450_000,
      outstanding: 275_000,
      customerCredit: 0,
      paymentStatus: 'partial',
    })
  })

  it('keeps one customer overpayment from hiding another invoice balance', () => {
    const overpaid = calculateInvoiceFinancials({ final_amount: 100_000, paid_amount: 120_000 })
    const unpaid = calculateInvoiceFinancials({ final_amount: 80_000, paid_amount: 0 })

    expect(overpaid.outstanding + unpaid.outstanding).toBe(80_000)
    expect(overpaid.customerCredit).toBe(20_000)
  })

  it('marks a base-paid invoice partial when an added folio charge is unpaid', () => {
    expect(calculateInvoiceFinancials({
      final_amount: 100_000,
      paid_amount: 100_000,
      booking_charges: { amount: 15_000, paid: false },
    }).paymentStatus).toBe('partial')
  })
})
