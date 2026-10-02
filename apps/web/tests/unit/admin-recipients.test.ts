/**
 * Unit tests for getTenantAdminContacts() (lib/notifications/admin-recipients.ts)
 * — the recipient-resolution behind every new booking/payment/check-in/
 * check-out admin alert. A minimal fake Supabase client stands in for the
 * real one, matching the style of tests/unit/resolve-occupant.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { getTenantAdminContacts } from '@/lib/notifications/admin-recipients'

function fakeSupabase(opts: {
  tenant: { contact_phone: string | null; contact_email: string | null; sms_enabled: boolean; email_enabled: boolean }
  members: Array<{ staff_profiles: { phone: string | null; email: string | null; is_active: boolean } }>
}) {
  const client: any = {
    from(table: string) {
      if (table === 'tenants') {
        return {
          select() { return this },
          eq() { return this },
          maybeSingle: async () => ({ data: opts.tenant }),
        }
      }
      if (table === 'tenant_members') {
        return {
          select() { return this },
          eq() { return this },
          in: async () => ({ data: opts.members }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
  return client
}

describe('getTenantAdminContacts', () => {
  it('prefers an active owner/manager staff phone+email over the tenant fallback', async () => {
    const client = fakeSupabase({
      tenant:  { contact_phone: '0200000000', contact_email: 'fallback@example.com', sms_enabled: true, email_enabled: true },
      members: [{ staff_profiles: { phone: '0244111111', email: 'owner@example.com', is_active: true } }],
    })

    const result = await getTenantAdminContacts(client, 'tenant-1')

    expect(result.phones).toEqual(['0244111111'])
    expect(result.emails).toEqual(['owner@example.com'])
    expect(result.smsEnabled).toBe(true)
    expect(result.emailEnabled).toBe(true)
  })

  it('falls back to the tenant contact_phone/contact_email when no staff member has one on file', async () => {
    const client = fakeSupabase({
      tenant:  { contact_phone: '0200000000', contact_email: 'fallback@example.com', sms_enabled: true, email_enabled: false },
      members: [],
    })

    const result = await getTenantAdminContacts(client, 'tenant-1')

    expect(result.phones).toEqual(['0200000000'])
    expect(result.emails).toEqual(['fallback@example.com'])
    expect(result.emailEnabled).toBe(false)
  })

  it('ignores an inactive staff member and falls back', async () => {
    const client = fakeSupabase({
      tenant:  { contact_phone: '0200000000', contact_email: null, sms_enabled: true, email_enabled: true },
      members: [{ staff_profiles: { phone: '0244111111', email: null, is_active: false } }],
    })

    const result = await getTenantAdminContacts(client, 'tenant-1')

    expect(result.phones).toEqual(['0200000000'])
    expect(result.emails).toEqual([])
  })

  it('dedupes multiple owner/manager phones', async () => {
    const client = fakeSupabase({
      tenant:  { contact_phone: null, contact_email: null, sms_enabled: true, email_enabled: true },
      members: [
        { staff_profiles: { phone: '0244111111', email: 'a@example.com', is_active: true } },
        { staff_profiles: { phone: '0244111111', email: 'b@example.com', is_active: true } },
      ],
    })

    const result = await getTenantAdminContacts(client, 'tenant-1')

    expect(result.phones).toEqual(['0244111111'])
    expect(result.emails.sort()).toEqual(['a@example.com', 'b@example.com'])
  })
})
