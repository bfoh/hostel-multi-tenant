import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { parseStatementCSV, uploadStatementRows, autoMatchStatements } from '@/lib/data/reconciliation'

export async function POST(request: NextRequest) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const formData = await request.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const csv = await file.text()
  const rows = parseStatementCSV(csv)

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'No valid rows found. Check that the CSV has date, description, and debit/credit columns.' },
      { status: 422 },
    )
  }

  const uploadId = crypto.randomUUID()
  const { inserted, error } = await uploadStatementRows(rows, tenantId, uploadId)

  if (error) return NextResponse.json({ error }, { status: 500 })

  // Auto-match in the background (fire-and-forget in route)
  const matched = await autoMatchStatements(tenantId, uploadId)

  return NextResponse.json({ uploadId, inserted, matched }, { status: 201 })
}
