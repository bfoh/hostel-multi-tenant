import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import type { ReportDefinition } from '@/lib/data/custom-reports'

interface CreateBody {
  name:        string
  description?:string
  definition:  ReportDefinition
}

const VALID_ACCOUNT_TYPES = new Set(['asset', 'liability', 'equity', 'revenue', 'expense'])
const VALID_PERIOD_KINDS  = new Set(['mtd', 'qtd', 'ytd', 'last_month', 'last_year', 'custom'])
const VALID_GROUPINGS     = new Set(['by_account', 'by_type'])
const VALID_COMPARISONS   = new Set(['none', 'prior_period', 'prior_year'])

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let body: CreateBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const d = body.definition
  if (!d || !Array.isArray(d.accountTypes) || d.accountTypes.length === 0) {
    return NextResponse.json({ error: 'definition.accountTypes required' }, { status: 400 })
  }
  for (const t of d.accountTypes) {
    if (!VALID_ACCOUNT_TYPES.has(t)) {
      return NextResponse.json({ error: `Invalid account type: ${t}` }, { status: 400 })
    }
  }
  if (!d.period || !VALID_PERIOD_KINDS.has(d.period.kind)) {
    return NextResponse.json({ error: 'definition.period.kind invalid' }, { status: 400 })
  }
  if (d.period.kind === 'custom' && (!d.period.from || !d.period.to)) {
    return NextResponse.json({ error: 'custom period requires from and to' }, { status: 400 })
  }
  if (!VALID_GROUPINGS.has(d.grouping)) {
    return NextResponse.json({ error: 'definition.grouping invalid' }, { status: 400 })
  }
  if (d.comparison && !VALID_COMPARISONS.has(d.comparison)) {
    return NextResponse.json({ error: 'definition.comparison invalid' }, { status: 400 })
  }

  const admin = await createTenantAdminClientFromHeaders()
  const { data, error } = await (admin as any)
    .from('custom_reports')
    .insert({
      tenant_id:   tenantId,
      name:        body.name.trim(),
      description: body.description?.trim() || null,
      definition:  d,
      created_by:  user.id,
    })
    .select('id')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
