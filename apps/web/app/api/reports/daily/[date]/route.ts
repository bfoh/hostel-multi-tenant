/**
 * GET  /api/reports/daily/[date]  → returns the daily report row (computing
 *                                   on demand when today's row is stale).
 *
 * POST /api/reports/daily/[date]  → force a recompute and return the row.
 *
 * Both routes are tenant-scoped via the x-tenant-id header and require an
 * authenticated tenant member.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getDailyReport, recomputeDailyReport } from '@/lib/reports/daily'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Invalid date (YYYY-MM-DD)' }, { status: 422 })
  }

  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const report = await getDailyReport(tenantId, date)
  if (!report) return NextResponse.json({ error: 'Report unavailable' }, { status: 500 })
  return NextResponse.json(report)
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Invalid date (YYYY-MM-DD)' }, { status: 422 })
  }

  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const report = await recomputeDailyReport(tenantId, date)
  if (!report) return NextResponse.json({ error: 'Recompute failed' }, { status: 500 })
  return NextResponse.json(report)
}
