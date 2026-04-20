import { NextResponse } from 'next/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { fetchBanks } from '@/lib/paystack'

export const dynamic = 'force-dynamic'

// GET /api/settings/payouts/banks → list of Ghana banks for the bank picker.
export async function GET() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: 'Paystack not configured' }, { status: 503 })
  }

  try {
    const banks = await fetchBanks({ country: 'ghana', currency: 'GHS' })
    return NextResponse.json({ banks })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to fetch banks' }, { status: 502 })
  }
}
