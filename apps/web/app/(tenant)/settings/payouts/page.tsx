import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { PayoutsForm } from '@/components/settings/payouts-form'

export const metadata: Metadata = { title: 'Payouts' }
export const dynamic = 'force-dynamic'

async function getPayoutsState() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('tenants')
    .select(`
      paystack_subaccount_code,
      paystack_bank_code,
      paystack_bank_account_no,
      paystack_settlement_bank,
      paystack_account_name,
      paystack_connected_at
    `)
    .eq('id', tenantId)
    .single()

  return {
    connected:        !!data?.paystack_subaccount_code,
    subaccount_code:  data?.paystack_subaccount_code ?? null,
    bank_code:        data?.paystack_bank_code ?? null,
    account_number:   data?.paystack_bank_account_no ?? null,
    settlement_bank:  data?.paystack_settlement_bank ?? null,
    account_name:     data?.paystack_account_name ?? null,
    connected_at:     data?.paystack_connected_at ?? null,
    paystack_status:  null,
  }
}

export default async function PayoutsPage() {
  const state = await getPayoutsState()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Payouts</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Connect the bank account that receives online guest and occupant payments.
          Transfers settle directly from Paystack to your bank — the platform never holds your funds.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        {!state ? (
          <p className="text-sm text-danger">Could not load tenant configuration.</p>
        ) : (
          <PayoutsForm initial={state} />
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface-sunken p-5 text-xs text-text-secondary space-y-2">
        <p className="font-medium text-text-primary">How it works</p>
        <ul className="space-y-1 list-disc pl-4">
          <li>You keep 100% of each guest payment. Paystack deducts only its own processing fee (~1.95% + GHS 0.50 cap).</li>
          <li>MoMo (MTN, Vodafone, AirtelTigo), card, and bank transfer all route to this account.</li>
          <li>Paystack settles T+1 to your Ghana bank for GHS transactions.</li>
          <li>The GH Hostels SaaS subscription is billed separately on your owner account.</li>
        </ul>
      </div>
    </div>
  )
}
