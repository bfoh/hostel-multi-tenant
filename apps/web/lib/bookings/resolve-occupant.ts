import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolves an occupant/guest to a real occupant_id for booking creation,
 * matching an existing occupant by phone number before creating a new one —
 * avoids duplicate occupant records piling up for a repeat hotel guest.
 * Used by both the single and group booking routes' inline-guest-capture
 * path (hotel-only at the UI layer; the hostel dropdown flow keeps sending
 * a real occupant_id directly and never calls this).
 */

export interface GuestInput {
  firstName: string
  lastName:  string
  phone:     string
  email?:    string | null
}

export async function resolveOccupant(
  supabase: SupabaseClient<any>,
  tenantId: string,
  guest: GuestInput,
): Promise<string> {
  const { data: existing } = await supabase
    .from('occupants')
    .select('id, first_name, last_name, email')
    .eq('tenant_id', tenantId)
    .eq('phone', guest.phone)
    .maybeSingle()

  if (existing) {
    const needsUpdate =
      existing.first_name !== guest.firstName ||
      existing.last_name !== guest.lastName ||
      (guest.email && existing.email !== guest.email)

    if (needsUpdate) {
      await supabase
        .from('occupants')
        .update({
          first_name: guest.firstName,
          last_name:  guest.lastName,
          ...(guest.email ? { email: guest.email } : {}),
        })
        .eq('id', existing.id)
    }
    return existing.id
  }

  const { data: created, error } = await supabase
    .from('occupants')
    .insert({
      tenant_id:  tenantId,
      type:       'guest',
      first_name: guest.firstName,
      last_name:  guest.lastName,
      phone:      guest.phone,
      email:      guest.email ?? null,
    })
    .select('id')
    .single()

  if (error || !created) {
    throw new Error(error?.message ?? 'Failed to create guest')
  }

  return created.id
}
