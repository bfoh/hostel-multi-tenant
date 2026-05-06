/**
 * Guest helpers for public food ordering channels (walk-in QR + online).
 *
 * - findOrCreateGuestOccupant mirrors apps/web/app/api/public/[slug]/book/route.ts:69-99
 * - generateTrackingToken builds an opaque URL-safe token used as guest auth
 *   on the public order tracker page
 */

import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

interface FindOrCreateArgs {
  tenantId:  string
  firstName: string
  lastName:  string
  phone:     string
  email:     string | null
}

export async function findOrCreateGuestOccupant(args: FindOrCreateArgs): Promise<{ id: string } | { error: string }> {
  const admin = createAdminClient() as any

  const { data: existing } = await admin
    .from('occupants')
    .select('id')
    .eq('tenant_id', args.tenantId)
    .eq('phone', args.phone)
    .maybeSingle()

  if (existing?.id) return { id: existing.id }

  const { data: created, error } = await admin
    .from('occupants')
    .insert({
      tenant_id:  args.tenantId,
      first_name: args.firstName,
      last_name:  args.lastName,
      phone:      args.phone,
      email:      args.email,
      status:     'pending',
      type:       'non_student',
    })
    .select('id')
    .single()

  if (error || !created) {
    return { error: error?.message ?? 'Failed to create guest occupant' }
  }
  return { id: created.id }
}

const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz'

/**
 * 24-character opaque token. base32-ish alphabet (no 0/O/1/I/l) for URL safety
 * and to avoid screenshot ambiguity. Uniqueness is enforced by the partial
 * unique index on `food_orders.tracking_token`; collisions retry at insert.
 */
export function generateTrackingToken(): string {
  const bytes = randomBytes(24)
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length]
  }
  return out
}
