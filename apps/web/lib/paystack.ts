/**
 * Paystack API client — server-side only.
 *
 * Handles two money flows for the GH Hostels platform:
 *
 *   Flow A  Hostel owner → Platform  (monthly SaaS subscription, card only)
 *   Flow B  Guest/Occupant → Hostel  (one-off, card + MoMo + bank via Subaccount)
 *
 * Uses the single platform merchant key (PAYSTACK_SECRET_KEY). Funds route to
 * hostels via per-tenant Paystack Subaccounts with percentage_charge = 0 and
 * bearer = 'subaccount' (hostel absorbs Paystack's processing fee; 100% net
 * settlement direction, platform takes no transaction cut).
 */

const PAYSTACK_BASE = 'https://api.paystack.co'

function getSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set')
  return key
}

function headers() {
  return {
    Authorization: `Bearer ${getSecretKey()}`,
    'Content-Type': 'application/json',
  }
}

// ── Low-level request helper ───────────────────────────────────────────────

async function paystackFetch<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers ?? {}) },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.status === false) {
    throw new Error(json.message ?? `Paystack ${path} failed (${res.status})`)
  }
  return json as T
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared types
// ═══════════════════════════════════════════════════════════════════════════

export type MoMoProvider = 'mtn' | 'vod' | 'atl'
export type PaymentChannel = 'card' | 'bank' | 'mobile_money' | 'ussd' | 'bank_transfer'

export interface InitiateChargeResult {
  reference: string
  status: string              // 'send_otp' | 'pay_offline' | 'success' | 'failed'
  displayText: string
  paystackReference: string
}

export interface InitializeTransactionResult {
  authorizationUrl: string
  accessCode: string
  reference: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Flow B — Guest/Occupant payments (via Subaccount)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Initiate a Ghana Mobile Money charge via Paystack.
 * Pass `subaccount` to route funds 100% to the hostel's bank.
 */
export async function initiateMoMoCharge(params: {
  email: string
  amountPesewas: number        // pesewas (GHS × 100)
  phone: string                // e.g. "0244000000"
  provider: MoMoProvider
  reference: string            // our internal unique ref
  metadata?: Record<string, unknown>
  subaccount?: string          // tenant.paystack_subaccount_code
  bearer?: 'account' | 'subaccount'
}): Promise<InitiateChargeResult> {
  const body: Record<string, unknown> = {
    email:    params.email,
    amount:   params.amountPesewas,
    currency: 'GHS',
    mobile_money: {
      phone:    params.phone,
      provider: params.provider,
    },
    reference: params.reference,
    metadata:  params.metadata ?? {},
  }

  if (params.subaccount) {
    body.subaccount = params.subaccount
    body.bearer     = params.bearer ?? 'subaccount'
  }

  const json = await paystackFetch<any>('/charge', {
    method: 'POST',
    body:   JSON.stringify(body),
  })

  return {
    reference:         params.reference,
    status:            json.data.status,
    displayText:       json.data.display_text ?? 'Check your phone to approve the payment.',
    paystackReference: json.data.reference,
  }
}

/**
 * Initialize a hosted Paystack transaction (card / MoMo / bank picker).
 * Returns an authorization_url to redirect the customer to.
 * Pass `subaccount` to route funds to a hostel.
 */
export async function initializeTransaction(params: {
  email: string
  amountPesewas: number
  reference: string
  callbackUrl: string
  currency?: string                          // defaults GHS
  channels?: PaymentChannel[]
  metadata?: Record<string, unknown>
  subaccount?: string
  bearer?: 'account' | 'subaccount'
  plan?: string                              // paystack plan_code → creates subscription on success
}): Promise<InitializeTransactionResult> {
  const body: Record<string, unknown> = {
    email:        params.email,
    amount:       params.amountPesewas,
    currency:     params.currency ?? 'GHS',
    reference:    params.reference,
    callback_url: params.callbackUrl,
    metadata:     params.metadata ?? {},
  }

  if (params.channels) body.channels = params.channels
  if (params.plan)     body.plan     = params.plan

  if (params.subaccount) {
    body.subaccount = params.subaccount
    body.bearer     = params.bearer ?? 'subaccount'
  }

  const json = await paystackFetch<any>('/transaction/initialize', {
    method: 'POST',
    body:   JSON.stringify(body),
  })

  return {
    authorizationUrl: json.data.authorization_url,
    accessCode:       json.data.access_code,
    reference:        json.data.reference,
  }
}

/**
 * Submit OTP to complete a charge that returned status: 'send_otp'.
 */
export async function submitOtp(reference: string, otp: string) {
  const json = await paystackFetch<any>('/charge/submit_otp', {
    method: 'POST',
    body:   JSON.stringify({ reference, otp }),
  })
  return json.data as { status: string; display_text?: string }
}

/**
 * Check the status of a charge or transaction.
 */
export async function verifyCharge(reference: string) {
  const json = await paystackFetch<any>(`/charge/${reference}`)
  return json.data as { status: string; amount: number; currency: string }
}

/**
 * Verify a hosted-transaction reference (post-callback).
 */
export async function verifyTransaction(reference: string) {
  const json = await paystackFetch<any>(`/transaction/verify/${reference}`)
  return json.data as {
    status: string
    reference: string
    amount: number
    currency: string
    paid_at: string
    channel: string
    metadata: Record<string, any>
    customer: { email: string; customer_code: string }
    plan?: string
    subaccount?: { subaccount_code: string }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Subaccount management (per-hostel payout routing)
// ═══════════════════════════════════════════════════════════════════════════

export interface Bank {
  name: string
  code: string
  currency: string
  country: string
  type: string
}

/**
 * List banks for a given country/currency. Use for onboarding dropdowns.
 */
export async function fetchBanks(opts: { country?: string; currency?: string } = {}) {
  const qs = new URLSearchParams({
    country:  opts.country  ?? 'ghana',
    currency: opts.currency ?? 'GHS',
    perPage:  '100',
  })
  const json = await paystackFetch<any>(`/bank?${qs.toString()}`)
  return (json.data ?? []) as Bank[]
}

/**
 * Validate a bank account number. Returns account holder name.
 */
export async function resolveAccountNumber(params: {
  accountNumber: string
  bankCode: string
}) {
  const qs = new URLSearchParams({
    account_number: params.accountNumber,
    bank_code:      params.bankCode,
  })
  const json = await paystackFetch<any>(`/bank/resolve?${qs.toString()}`)
  return json.data as { account_number: string; account_name: string }
}

export interface Subaccount {
  subaccount_code: string
  business_name: string
  settlement_bank: string
  account_number: string
  percentage_charge: number
  active: boolean
}

/**
 * Create a Paystack Subaccount for a hostel.
 * Guest payments that pass this subaccount_code will settle to the hostel's bank.
 */
export async function createSubaccount(params: {
  businessName: string
  bankCode: string
  accountNumber: string
  percentageCharge?: number    // 0 = platform takes nothing (default)
  primaryContactEmail?: string
  primaryContactName?: string
  primaryContactPhone?: string
  description?: string
  metadata?: Record<string, unknown>
}): Promise<Subaccount> {
  const body = {
    business_name:         params.businessName,
    bank_code:             params.bankCode,
    account_number:        params.accountNumber,
    percentage_charge:     params.percentageCharge ?? 0,
    primary_contact_email: params.primaryContactEmail,
    primary_contact_name:  params.primaryContactName,
    primary_contact_phone: params.primaryContactPhone,
    description:           params.description,
    metadata:              params.metadata,
  }
  const json = await paystackFetch<any>('/subaccount', {
    method: 'POST',
    body:   JSON.stringify(body),
  })
  return json.data as Subaccount
}

/**
 * Update an existing subaccount (e.g. change bank account).
 */
export async function updateSubaccount(
  idOrCode: string,
  params: Partial<{
    businessName: string
    bankCode: string
    accountNumber: string
    percentageCharge: number
    active: boolean
  }>,
): Promise<Subaccount> {
  const body: Record<string, unknown> = {}
  if (params.businessName     !== undefined) body.business_name     = params.businessName
  if (params.bankCode         !== undefined) body.bank_code         = params.bankCode
  if (params.accountNumber    !== undefined) body.account_number    = params.accountNumber
  if (params.percentageCharge !== undefined) body.percentage_charge = params.percentageCharge
  if (params.active           !== undefined) body.active            = params.active

  const json = await paystackFetch<any>(`/subaccount/${idOrCode}`, {
    method: 'PUT',
    body:   JSON.stringify(body),
  })
  return json.data as Subaccount
}

export async function fetchSubaccount(idOrCode: string): Promise<Subaccount> {
  const json = await paystackFetch<any>(`/subaccount/${idOrCode}`)
  return json.data as Subaccount
}

// ═══════════════════════════════════════════════════════════════════════════
// Flow A — Platform subscriptions (hostel owner → platform, card only)
// ═══════════════════════════════════════════════════════════════════════════

export interface Plan {
  plan_code: string
  name: string
  amount: number            // pesewas
  interval: string
  currency: string
}

/**
 * Create a subscription plan on the platform merchant.
 * Run once per pricing tier (Starter / Pro / Enterprise).
 */
export async function createPlan(params: {
  name: string
  amountPesewas: number
  interval: 'daily' | 'weekly' | 'monthly' | 'biannually' | 'annually'
  description?: string
  currency?: string
}): Promise<Plan> {
  const body = {
    name:        params.name,
    amount:      params.amountPesewas,
    interval:    params.interval,
    description: params.description,
    currency:    params.currency ?? 'GHS',
  }
  const json = await paystackFetch<any>('/plan', {
    method: 'POST',
    body:   JSON.stringify(body),
  })
  return json.data as Plan
}

export async function fetchPlan(idOrCode: string): Promise<Plan> {
  const json = await paystackFetch<any>(`/plan/${idOrCode}`)
  return json.data as Plan
}

export interface Customer {
  customer_code: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
}

/**
 * Create (or fetch-if-exists) a Paystack customer record.
 */
export async function createCustomer(params: {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  metadata?: Record<string, unknown>
}): Promise<Customer> {
  const body = {
    email:      params.email,
    first_name: params.firstName,
    last_name:  params.lastName,
    phone:      params.phone,
    metadata:   params.metadata,
  }
  const json = await paystackFetch<any>('/customer', {
    method: 'POST',
    body:   JSON.stringify(body),
  })
  return json.data as Customer
}

/**
 * Manually create a subscription (use only when you already have a customer
 * authorization code). The preferred path is: initializeTransaction({ plan })
 * — Paystack auto-creates the subscription on successful first charge.
 */
export async function createSubscription(params: {
  customer: string            // customer_code or email
  plan: string                // plan_code
  authorization?: string      // authorization_code from a prior card charge
  startDate?: string          // ISO date
}) {
  const body = {
    customer:      params.customer,
    plan:          params.plan,
    authorization: params.authorization,
    start_date:    params.startDate,
  }
  const json = await paystackFetch<any>('/subscription', {
    method: 'POST',
    body:   JSON.stringify(body),
  })
  return json.data as {
    subscription_code: string
    email_token: string
    status: string
    next_payment_date: string
  }
}

export async function disableSubscription(params: { code: string; token: string }) {
  const json = await paystackFetch<any>('/subscription/disable', {
    method: 'POST',
    body:   JSON.stringify(params),
  })
  return json.data as { status: string }
}

export async function enableSubscription(params: { code: string; token: string }) {
  const json = await paystackFetch<any>('/subscription/enable', {
    method: 'POST',
    body:   JSON.stringify(params),
  })
  return json.data as { status: string }
}

/**
 * Paystack-hosted "manage card" link the tenant owner can visit to update
 * their payment method.
 */
export async function generateSubscriptionManageLink(subscriptionCode: string) {
  const json = await paystackFetch<any>(`/subscription/${subscriptionCode}/manage/link`)
  return json.data as { link: string }
}

export async function fetchSubscription(idOrCode: string) {
  const json = await paystackFetch<any>(`/subscription/${idOrCode}`)
  return json.data as {
    subscription_code: string
    email_token: string
    status: string
    next_payment_date: string
    amount: number
    plan: { plan_code: string; name: string; amount: number; interval: string }
    customer: { customer_code: string; email: string }
  }
}

/**
 * List subscriptions on the platform merchant. Filter by customer/plan to
 * find a freshly-created subscription after the initial transaction (useful
 * in the callback to populate our DB without waiting for the webhook).
 */
export async function listSubscriptions(params: {
  customer?: string | number   // customer_code or numeric id
  plan?:     string            // plan_code
  perPage?:  number
  page?:     number
} = {}) {
  const qs = new URLSearchParams()
  if (params.customer !== undefined) qs.set('customer', String(params.customer))
  if (params.plan     !== undefined) qs.set('plan',     params.plan)
  qs.set('perPage', String(params.perPage ?? 50))
  qs.set('page',    String(params.page    ?? 1))
  const json = await paystackFetch<any>(`/subscription?${qs.toString()}`)
  return (json.data ?? []) as Array<{
    subscription_code: string
    email_token: string
    status: string
    next_payment_date: string
    amount: number
    createdAt?: string
    created_at?: string
    plan: { plan_code: string; name: string; amount: number; interval: string; currency: string }
    customer: { customer_code: string; email: string }
  }>
}

// ═══════════════════════════════════════════════════════════════════════════
// Webhook signature verification
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verify a webhook event signature.
 * Paystack sends X-Paystack-Signature header (HMAC-SHA512 of raw body).
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const crypto = require('crypto') // eslint-disable-line @typescript-eslint/no-var-requires
  const hash = crypto
    .createHmac('sha512', getSecretKey())
    .update(rawBody)
    .digest('hex')
  return hash === signature
}
