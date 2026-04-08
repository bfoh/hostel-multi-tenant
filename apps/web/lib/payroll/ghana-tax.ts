/**
 * Ghana payroll computation engine.
 * Tax bands: Ghana Revenue Authority (GRA) 2024.
 * SSNIT: Social Security & National Insurance Trust.
 *
 * All amounts in pesewas (GHS × 100).
 */

// ── GRA PAYE Annual Tax Bands (GHS, 2024) ─────────────────────────────────────
// Source: GRA website — https://gra.gov.gh
const ANNUAL_BANDS = [
  { limit: 480_00,      rate: 0.00 },   // First GHS 480    → 0%
  { limit: 1_320_00,    rate: 0.05 },   // Next  GHS 1,320  → 5%
  { limit: 3_816_00,    rate: 0.10 },   // Next  GHS 3,816  → 10%
  { limit: 42_000_00,   rate: 0.175 },  // Next  GHS 42,000 → 17.5%
  { limit: 240_000_00,  rate: 0.25 },   // Next  GHS 240,000→ 25%
  { limit: Infinity,    rate: 0.30 },   // Above            → 30%
]

// SSNIT rates
const SSNIT_EMPLOYEE_RATE = 0.055   // 5.5% of basic salary
const SSNIT_EMPLOYER_RATE = 0.13    // 13% of basic salary

/** Compute annual PAYE tax on taxable income (pesewas). */
function computeAnnualPAYE(annualTaxableIncomePesewas: number): number {
  let remaining = annualTaxableIncomePesewas
  let tax = 0
  let previousLimit = 0

  for (const band of ANNUAL_BANDS) {
    const bandSize = band.limit === Infinity
      ? remaining
      : Math.min(remaining, band.limit - previousLimit)

    if (bandSize <= 0) break

    tax += bandSize * band.rate
    remaining -= bandSize
    previousLimit = band.limit === Infinity ? previousLimit : band.limit

    if (remaining <= 0) break
  }

  return Math.round(tax)
}

export interface PayrollComputation {
  basicSalary:   number   // pesewas/month
  allowances:    number   // pesewas/month
  grossSalary:   number
  ssnitEmployee: number   // 5.5% of basic
  ssnitEmployer: number   // 13% of basic
  taxableIncome: number   // gross - ssnit_employee
  payeTax:       number   // monthly PAYE
  totalDeductions: number
  netSalary:     number
}

/**
 * Compute one month's payroll for a single employee.
 * @param basicSalaryPesewas  Monthly basic salary in pesewas
 * @param allowancesPesewas   Monthly allowances in pesewas
 * @param isSSNITExempt       True for exempt employees
 */
export function computeMonthlyPayroll(
  basicSalaryPesewas: number,
  allowancesPesewas   = 0,
  isSSNITExempt       = false,
): PayrollComputation {
  const grossSalary   = basicSalaryPesewas + allowancesPesewas
  const ssnitEmployee = isSSNITExempt ? 0 : Math.round(basicSalaryPesewas * SSNIT_EMPLOYEE_RATE)
  const ssnitEmployer = isSSNITExempt ? 0 : Math.round(basicSalaryPesewas * SSNIT_EMPLOYER_RATE)

  // Taxable income = gross - SSNIT employee contribution
  const taxableIncome    = grossSalary - ssnitEmployee
  const annualTaxable    = taxableIncome * 12
  const annualPAYE       = computeAnnualPAYE(annualTaxable)
  const monthlyPAYE      = Math.round(annualPAYE / 12)

  const totalDeductions  = ssnitEmployee + monthlyPAYE
  const netSalary        = grossSalary - totalDeductions

  return {
    basicSalary:    basicSalaryPesewas,
    allowances:     allowancesPesewas,
    grossSalary,
    ssnitEmployee,
    ssnitEmployer,
    taxableIncome,
    payeTax:        monthlyPAYE,
    totalDeductions,
    netSalary,
  }
}

/** Format a computation for display/storage. */
export function formatPayrollSummary(c: PayrollComputation) {
  return {
    basic_salary:    c.basicSalary,
    allowances:      c.allowances,
    ssnit_employee:  c.ssnitEmployee,
    ssnit_employer:  c.ssnitEmployer,
    paye_tax:        c.payeTax,
    other_deductions: 0,
    net_salary:      c.netSalary,
  }
}
