import type { SupabaseClient } from '@supabase/supabase-js'

export const CAMPAIGN_AUDIENCES = ['all_occupants', 'active_occupants', 'past_guests'] as const
export type CampaignAudience = typeof CAMPAIGN_AUDIENCES[number]

export const CAMPAIGN_CHANNELS = ['sms', 'email'] as const
export type CampaignChannel = typeof CAMPAIGN_CHANNELS[number]

export const CAMPAIGN_AUDIENCE_LABEL: Record<CampaignAudience, string> = {
  all_occupants:    'All occupants',
  active_occupants: 'Currently checked in',
  past_guests:      'Past guests (checked out)',
}

/**
 * Distinct contact values (phone for sms, email for email) for the given
 * audience — the single source of truth for both the draft's dry-run
 * recipient_count and the actual send, so they can never drift apart.
 */
export async function resolveAudience(
  supabase: SupabaseClient<any>,
  tenantId: string,
  audience: CampaignAudience,
  channel: CampaignChannel,
): Promise<string[]> {
  const field = channel === 'sms' ? 'phone' : 'email'
  let query = supabase.from('occupants').select(field).eq('tenant_id', tenantId)
  if (audience === 'active_occupants') query = query.eq('status', 'active')
  if (audience === 'past_guests')      query = query.eq('status', 'checked_out')

  const { data } = await query
  const contacts = (data ?? []).map((row: any) => row[field]).filter(Boolean) as string[]
  return Array.from(new Set(contacts))
}
