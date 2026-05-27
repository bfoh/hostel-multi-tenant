import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { sendEmail, newTenantLeadHtml } from '@/lib/email'
import { onboardingLimiter, enforceRateLimit } from '@/lib/rate-limit'

const schema = z.object({
  tenantId:       z.string().uuid().optional(),
  name:           z.string().min(2).max(120),
  slug:           z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
  custom_domain:  z.string().max(253).regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/).optional().nullable(),
  tagline:        z.string().max(200).optional().nullable(),
  contact_phone:  z.string().max(30).optional().nullable(),
  contact_email:  z.string().email().optional().nullable(),
  address_city:   z.string().max(100).optional().nullable(),
  address_region: z.string().max(100).optional().nullable(),
  currency:       z.string().max(10).optional().default('GHS'),
  timezone:       z.string().max(60).optional().default('Africa/Accra'),
})

const OPS_EMAIL = process.env.PLATFORM_OPS_EMAIL ?? 'bfoh2g@gmail.com'

/**
 * POST /api/onboarding/identity
 *
 * Called from the wizard when the owner advances from step 1 (Identity) to
 * step 2 (Branding). Persists identity fields so the wizard is recoverable
 * if the owner bounces, and dispatches a single new-tenant lead notification
 * to platform ops.
 *
 * The lead email is fire-and-forget; failures do not block the wizard.
 */
export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(onboardingLimiter, request, 'identity')
  if (limited) return limited

  const body   = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()

  let tenantId = await getServerTenantId() ?? parsed.data.tenantId ?? null
  if (!tenantId && user) {
    const admin = createAdminClient()
    const { data: m } = await admin
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    tenantId = m?.tenant_id ?? null
  }

  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const admin = createAdminClient()
  const d = parsed.data

  // Slug uniqueness — wizard already polls /check-slug but defend against races
  const { data: existing } = await admin
    .from('tenants')
    .select('id, slug, custom_domain, identity_completed_at, lead_notified_at')
    .eq('id', tenantId)
    .single() as { data: any }

  if (existing && existing.slug !== d.slug) {
    const { data: slugTaken } = await admin
      .from('tenants').select('id').eq('slug', d.slug).neq('id', tenantId).maybeSingle()
    if (slugTaken) {
      return NextResponse.json({ error: 'slug_taken', message: 'That URL is already taken' }, { status: 409 })
    }
  }

  if (d.custom_domain && d.custom_domain !== existing?.custom_domain) {
    const { data: domainTaken } = await admin
      .from('tenants').select('id').eq('custom_domain', d.custom_domain).neq('id', tenantId).maybeSingle()
    if (domainTaken) {
      return NextResponse.json({ error: 'domain_taken', message: 'That domain is already registered' }, { status: 409 })
    }
  }

  const now = new Date().toISOString()

  const { error: updErr } = await (admin.from('tenants') as any)
    .update({
      name:                  d.name,
      slug:                  d.slug,
      tagline:               d.tagline ?? null,
      contact_phone:         d.contact_phone ?? null,
      contact_email:         d.contact_email ?? null,
      address_city:          d.address_city ?? null,
      address_region:        d.address_region ?? null,
      currency:              d.currency ?? 'GHS',
      timezone:              d.timezone ?? 'Africa/Accra',
      custom_domain:         d.custom_domain ?? null,
      identity_completed_at: now,
    })
    .eq('id', tenantId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // Fire ops notification once per tenant.
  if (!existing?.lead_notified_at) {
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
    const protocol  = appDomain.includes('localhost') ? 'http' : 'https'
    const dashboardUrl = `${protocol}://${d.slug}.${appDomain}/dashboard`

    const ownerName  = (user?.user_metadata?.full_name as string | undefined) ?? null
    const ownerEmail = user?.email ?? '—'
    const selectedPlan = (user?.user_metadata?.selected_plan as string | undefined) ?? null

    // Mark as sent first so a Resend retry can't double-fire on a slow webhook.
    await (admin.from('tenants') as any)
      .update({ lead_notified_at: now })
      .eq('id', tenantId)

    sendEmail({
      to:         OPS_EMAIL,
      subject:    `New signup: ${d.name}`,
      senderName: 'GH Hostels Signups',
      replyTo:    ownerEmail,
      html: newTenantLeadHtml({
        hostelName:    d.name,
        ownerEmail,
        ownerName,
        slug:          d.slug,
        customDomain:  d.custom_domain ?? null,
        contactPhone:  d.contact_phone ?? null,
        contactEmail:  d.contact_email ?? null,
        city:          d.address_city ?? null,
        region:        d.address_region ?? null,
        tagline:       d.tagline ?? null,
        selectedPlan,
        signupAt:      new Date().toLocaleString('en-GB', { timeZone: 'Africa/Accra' }) + ' (GMT)',
        dashboardUrl,
      }),
    }).catch((err) => {
      console.error('[onboarding/identity] lead notification failed:', err)
    })
  }

  return NextResponse.json({ ok: true })
}
