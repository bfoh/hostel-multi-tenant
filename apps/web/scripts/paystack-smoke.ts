#!/usr/bin/env tsx
/**
 * Paystack test-mode smoke: verifies the server-side lib talks to Paystack
 * sandbox correctly. Run: `tsx scripts/paystack-smoke.ts`
 *
 * Requires PAYSTACK_SECRET_KEY=sk_test_... in apps/web/.env.local.
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'
import {
  fetchBanks,
  resolveAccountNumber,
  createPlan,
  fetchPlan,
} from '../lib/paystack'

config({ path: resolve(__dirname, '..', '.env.local') })

const key = process.env.PAYSTACK_SECRET_KEY
if (!key) { console.error('PAYSTACK_SECRET_KEY missing'); process.exit(1) }
if (!key.startsWith('sk_test_')) {
  console.error('Refusing to run against live key — test key only (sk_test_*)')
  process.exit(1)
}

async function main() {
  console.log('▸ Fetch Ghana banks...')
  const banks = await fetchBanks({ country: 'ghana', currency: 'GHS' })
  const gcb = banks.find((b) => /GCB|Ghana Commercial/i.test(b.name))
  console.log(`   ok — ${banks.length} banks, sample: ${gcb?.name} (${gcb?.code})`)

  console.log('▸ Resolve a known test account (Paystack sandbox accepts 0000000000)...')
  try {
    const r = await resolveAccountNumber({ bankCode: gcb!.code, accountNumber: '0000000000' })
    console.log(`   ok — ${r.account_name}`)
  } catch (e: any) {
    console.log(`   expected fail — ${e.message}`)
  }

  console.log('▸ Create a throwaway plan...')
  const name = `smoke-${Date.now()}`
  const plan = await createPlan({ name, amountPesewas: 100, interval: 'monthly', currency: 'GHS' })
  console.log(`   ok — code=${plan.plan_code}`)

  console.log('▸ Re-fetch the plan...')
  const back = await fetchPlan(plan.plan_code)
  console.log(`   ok — ${back.name} @ ${back.amount} ${back.currency}`)

  console.log('\n✓ Paystack test-mode connectivity verified')
}

main().catch((e) => { console.error('smoke failed', e); process.exit(1) })
