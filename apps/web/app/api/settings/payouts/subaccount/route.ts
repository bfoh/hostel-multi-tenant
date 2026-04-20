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

  try {
    let subaccountCode: string

    if (tenant.paystack_subaccount_code) {
      // Update existing subaccount (bank change)
      const sa = await updateSubaccount(tenant.paystack_subaccount_code, {
        bankCode:         parsed.data.bank_code,
        accountNumber:    parsed.data.account_number,
        percentageCharge: 0,
        active:           true,
      })
      subaccountCode = sa.subaccount_code
    } else {
      // Create fresh
      const sa = await createSubaccount({
        businessName:         tenant.name,
        bankCode:             parsed.data.bank_code,
        accountNumber:        parsed.data.account_number,
        percentageCharge:     0,
        primaryContactEmail:  (tenant as any).contact_email ?? undefined,
        primaryContactPhone:  (tenant as any).contact_phone ?? undefined,
        primaryContactName:   tenant.name,
        description:          `GH Hostels payouts for ${tenant.name}`,
        metadata:             { tenant_id: tenantId },
      })
      subaccountCode = sa.subaccount_code
    }

    const { error: updateErr } = await admin
      .from('tenants')
      .update({
        paystack_subaccount_code:  subaccountCode,
        paystack_bank_code:        parsed.data.bank_code,
        paystack_bank_account_no:  parsed.data.account_number,
        paystack_settlement_bank:  parsed.data.settlement_bank,
        paystack_account_name:     parsed.data.account_name,
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
