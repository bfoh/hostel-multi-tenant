/**
 * Resolves who should receive owner/admin-facing transactional alerts
 * (new booking, payment received, check-in, check-out, cancellation) for a
 * tenant — generalizes the recipient-resolution pattern already used for
 * bank-draft admin alerts (lib/bank-draft.ts): active owner/manager
 * tenant_members joined to staff_profiles for phone+email, falling back to
 * the tenant's own contact_phone/contact_email when no staff member has
 * one on file. Also returns the tenant's sms_enabled/email_enabled toggles
 * so callers gate sends the same way Settings → Notifications describes.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface TenantAdminContacts {
  phones:       string[]
  emails:       string[]
  smsEnabled:   boolean
  emailEnabled: boolean
}

export async function getTenantAdminContacts(
  supabase: SupabaseClient<any>,
  tenantId: string,
): Promise<TenantAdminContacts> {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('contact_phone, contact_email, sms_enabled, email_enabled')
    .eq('id', tenantId)
    .maybeSingle()

  // Anchor filters on tenant_members so PostgREST applies them as SQL WHERE
  // clauses (filtering on joined-table columns via dot notation isn't
  // reliable) — same approach as lib/bank-draft.ts's admin SMS resolution.
  const { data: members } = await (supabase as any)
    .from('tenant_members')
    .select('staff_profiles!inner(phone, email, is_active)')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('role', ['owner', 'manager'])

  const phones = new Set<string>()
  const emails = new Set<string>()
  for (const row of (members ?? []) as Array<{ staff_profiles: { phone: string | null; email: string | null; is_active: boolean } | null }>) {
    const sp = row.staff_profiles
    if (!sp?.is_active) continue
    if (sp.phone) phones.add(sp.phone)
    if (sp.email) emails.add(sp.email)
  }

  if (phones.size === 0 && tenant?.contact_phone) phones.add(tenant.contact_phone)
  if (emails.size === 0 && tenant?.contact_email) emails.add(tenant.contact_email)

  return {
    phones:       [...phones],
    emails:       [...emails],
    smsEnabled:   tenant?.sms_enabled   ?? true,
    emailEnabled: tenant?.email_enabled ?? true,
  }
}
