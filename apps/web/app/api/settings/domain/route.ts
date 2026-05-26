import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { invalidateTenantCache } from '@/lib/tenant/resolve'

const schema = z.object({
  custom_domain: z.string()
    .max(253)
    .regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/, 'Invalid domain format')
    .optional()
    .nullable()
    .transform(v => v?.toLowerCase() ?? null),
})

/**
 * PATCH /api/settings/domain
 * Saves the custom_domain on the tenant record, then registers it with Vercel.
 */
export async function PATCH(request: NextRequest) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const body   = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const domain = parsed.data.custom_domain

  // Use the admin client so RLS on the tenants table (which has no UPDATE
  // policy for authenticated sessions) doesn't silently drop the update.
  // The middleware has already proven tenant ownership via x-tenant-id.
  const supabase = await createTenantAdminClientFromHeaders()

  // Reject if another tenant already owns this domain
  if (domain) {
    const { data: clash } = await supabase
      .from('tenants')
      .select('id')
      .eq('custom_domain', domain)
      .neq('id', tenantId)
      .maybeSingle()
    if (clash) {
      return NextResponse.json(
        { error: 'domain_taken', message: 'That domain is already registered to another hostel.' },
        { status: 409 },
      )
    }
  }

  // Capture the previous domain so we can bust its tenant-resolve cache too
  const { data: prev } = await supabase
    .from('tenants')
    .select('custom_domain')
    .eq('id', tenantId)
    .maybeSingle()

  const { error: dbErr } = await supabase
    .from('tenants')
    .update({ custom_domain: domain })
    .eq('id', tenantId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Flush tenant-resolve cache for both old and new hostnames so middleware
  // picks up the change without waiting for the TTL.
  if (prev?.custom_domain) await invalidateTenantCache(prev.custom_domain)
  if (domain)              await invalidateTenantCache(domain)

  // If a domain is set, register with Vercel Domains API
  if (domain) {
    const vercelToken = process.env.VERCEL_TOKEN
    const vercelTeamId = process.env.VERCEL_TEAM_ID
    const vercelProjectId = process.env.VERCEL_PROJECT_ID

    if (vercelToken && vercelProjectId) {
      const url = `https://api.vercel.com/v10/projects/${vercelProjectId}/domains${vercelTeamId ? `?teamId=${vercelTeamId}` : ''}`
      const vRes = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: domain }),
      })

      if (!vRes.ok) {
        const vData = await vRes.json().catch(() => ({}))
        // Don't block on Vercel errors — domain saved in DB, surface warning
        return NextResponse.json({
          ok: true,
          warning: `Domain saved but Vercel registration failed: ${vData.error?.message ?? vRes.status}`,
        })
      }
    }
    // No Vercel credentials set — domain saved, manual DNS instructions apply
  }

  return NextResponse.json({ ok: true })
}

/**
 * GET /api/settings/domain/verify
 * Checks Vercel's verification status for the tenant's custom domain.
 */
export async function GET(_req: NextRequest) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('custom_domain')
    .eq('id', tenantId)
    .maybeSingle()

  if (!tenant?.custom_domain) return NextResponse.json({ verified: false, reason: 'No domain configured' })

  const vercelToken = process.env.VERCEL_TOKEN
  const vercelTeamId = process.env.VERCEL_TEAM_ID
  const vercelProjectId = process.env.VERCEL_PROJECT_ID

  if (!vercelToken || !vercelProjectId) {
    return NextResponse.json({ verified: null, reason: 'Vercel API not configured — check DNS manually' })
  }

  const url = `https://api.vercel.com/v10/projects/${vercelProjectId}/domains/${tenant.custom_domain}${vercelTeamId ? `?teamId=${vercelTeamId}` : ''}`
  const vRes = await fetch(url, { headers: { Authorization: `Bearer ${vercelToken}` } })
  const vData = await vRes.json().catch(() => ({}))

  return NextResponse.json({
    verified: vData.verified ?? false,
    misconfigured: vData.misconfigured ?? false,
    verification: vData.verification ?? [],
  })
}
