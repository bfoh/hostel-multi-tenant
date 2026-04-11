/**
 * Ghana Revenue Authority (GRA) tax computation utilities
 *
 * VAT:      15% of taxable supply
 * NHIL:     2.5% of taxable supply   (National Health Insurance Levy)
 * GETFund:  2.5% of taxable supply   (Ghana Education Trust Fund)
 *
 * Total levy rate: 20%
 * Split ratio: VAT 15 / NHIL 2.5 / GETFund 2.5 = 6 : 1 : 1
 *
 * All amounts in pesewas (integer, GHS × 100).
 */

export interface GhanaTaxBreakdown {
  subtotal:      number  // taxable supply before levies
  vat:           number  // 15%
  nhil:          number  // 2.5%
  getfund:       number  // 2.5%
  totalTax:      number  // 20%
  total:         number  // subtotal + totalTax
}

/**
 * Compute Ghana VAT/NHIL/GETFund from a subtotal (pesewas).
 * Rounds each levy to the nearest pesewa; rounding errors accumulate in VAT.
 */
export function computeGhanaTax(subtotalPesewas: number): GhanaTaxBreakdown {
  const nhil    = Math.round(subtotalPesewas * 0.025)
  const getfund = Math.round(subtotalPesewas * 0.025)
  const vat     = Math.round(subtotalPesewas * 0.15)
  const totalTax = vat + nhil + getfund
  return {
    subtotal: subtotalPesewas,
    vat,
    nhil,
    getfund,
    totalTax,
    total: subtotalPesewas + totalTax,
  }
}

/**
 * Split a combined tax_amount back into VAT / NHIL / GETFund.
 * Used when we only have the total levy stored (legacy rows).
 * Split: VAT = 75%, NHIL = 12.5%, GETFund = 12.5%
 */
export function splitGhanaTax(combinedTaxPesewas: number): {
  vat: number; nhil: number; getfund: number
} {
  const nhil    = Math.round(combinedTaxPesewas * 0.125)
  const getfund = Math.round(combinedTaxPesewas * 0.125)
  const vat     = combinedTaxPesewas - nhil - getfund   // remainder to VAT
  return { vat, nhil, getfund }
}

/** Format a pesewa value as GHS string, e.g. "GH₵ 1,250.00" */
export function formatGHSTax(pesewas: number): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
  }).format(pesewas / 100)
}
