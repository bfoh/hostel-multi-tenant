import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import {
  createSubaccount,
  updateSubaccount,
  fetchSubaccount,
} from '@/lib/paystack'

const schema = z.object({
  bank_code:       z.string().min(1),
  account_number:  z.string().min(5).max(20),
  account_name:    z.string().min(2).max(200),
  settlement_bank: z.string().min(1).max(200),  // bank name (display)
})

// GET /api/settings/payouts/subaccount → current subaccount state
export async function GET() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const admin = createAdminClient()
  const { data: tenant, error } = await admin
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If connected, fetch live status from Paystack to detect disabled/inactive subaccounts
  let paystackStatus: { active: boolean } | null = null
  if (tenant?.paystack_subaccount_code) {
    try {
      const sa = await fetchSubaccount(tenant.paystack_subaccount_code)
      paystackStatus = { active: sa.active }
    } catch {
      paystackStatus = null
    }
  }

  return NextResponse.json({
    connected:          !!tenant?.paystack_subaccount_code,
    subaccount_code:    tenant?.paystack_subaccount_code ?? null,
    bank_code:          tenant?.paystack_bank_code ?? null,
    account_number:     tenant?.paystack_bank_account_no ?? null,
    settlement_bank:    tenant?.paystack_settlement_bank ?? null,
    account_name:       tenant?.paystack_account_name ?? null,
    connected_at:       tenant?.paystack_connected_at ?? null,
    paystack_status:    paystackStatus,
  })
}

// POST /api/settings/payouts/subaccount → create or update subaccount
export async function POST(req: NextRequest) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const admin = createAdminClient()

  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, contact_email, contact_phone, paystack_subaccount_code')
    .eq('id', tenantId)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const input = parsed.data
  const t     = tenant

  async function createFresh() {
    const sa = await createSubaccount({
      businessName:         t.name,
      bankCode:             input.bank_code,
      accountNumber:        input.account_number,
      percentageCharge:     0,
      primaryContactEmail:  (t as any).contact_email ?? undefined,
      primaryContactPhone:  (t as any).contact_phone ?? undefined,
      primaryContactName:   t.name,
      description:          `GH Hostels payouts for ${t.name}`,
      metadata:             { tenant_id: tenantId },
    })
    return sa.subaccount_code
  }

  try {
    let subaccountCode: string

    if (t.paystack_subaccount_code) {
      // Update existing subaccount (bank change). Subaccount codes are
      // key-scoped in Paystack: a code minted with sk_test_ doesn't exist
      // under sk_live_ and vice versa. If the update fails because the
      // stored code isn't recognised by the current key, fall back to
      // creating a fresh subaccount.
      try {
        const sa = await updateSubaccount(t.paystack_subaccount_code, {
          bankCode:         input.bank_code,
          accountNumber:    input.account_number,
          percentageCharge: 0,
          active:           true,
        })
        subaccountCode = sa.subaccount_code
      } catch (err: any) {
        const msg = String(err?.message ?? '').toLowerCase()
        const stale = msg.includes('not found')
                   || msg.includes('invalid subaccount')
                   || msg.includes('does not exist')
                   || msg.includes('no record')
        if (!stale) throw err
        subaccountCode = await createFresh()
      }
    } else {
      subaccountCode = await createFresh()
    }

    const { error: updateErr } = await admin
      .from('tenants')
      .update({
        paystack_subaccount_code:  subaccountCode,
        paystack_bank_code:        input.bank_code,
        paystack_bank_account_no:  input.account_number,
        paystack_settlement_bank:  input.settlement_bank,
        paystack_account_name:     input.account_name,
        paystack_connected_at:     new Date().toISOString(),
      })
      .eq('id', tenantId)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    return NextResponse.json({
      ok:              true,
      subaccount_code: subaccountCode,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to save subaccount' }, { status: 502 })
  }
}
