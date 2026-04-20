import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getServerTenantId } from '@/lib/auth/tenant'
import { resolveAccountNumber } from '@/lib/paystack'

const schema = z.object({
  bank_code:       z.string().min(1),
  account_number:  z.string().min(5).max(20),
})

// POST /api/settings/payouts/resolve-account
// { bank_code, account_number } → { account_name }
export async function POST(req: NextRequest) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  try {
    const data = await resolveAccountNumber({
      accountNumber: parsed.data.account_number,
      bankCode:      parsed.data.bank_code,
    })
    return NextResponse.json({
      account_name:   data.account_name,
      account_number: data.account_number,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Could not verify account' }, { status: 422 })
  }
}
