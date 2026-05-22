/**
 * Resolve human-readable display names + roles for a batch of user ids
 * within a tenant. Used by inbox + thread headers.
 *
 * A user may be either a staff member (tenant_members → first_name/last_name
 * on tenant_member_profiles, falling back to auth email) or an occupant
 * (occupants table). We try occupants first because most messaging is
 * staff↔occupant.
 */
import { createAdminClient } from '@/lib/supabase/admin'

export interface PeerProfile {
  user_id:     string
  display:     string
  subtitle:    string | null     // e.g. "Receptionist" or "Room 12 · Block A"
  kind:        'staff' | 'occupant' | 'unknown'
  avatar_url:  string | null
}

export type PeerMap = Record<string, PeerProfile>

export async function resolvePeerDisplayNames(
  tenantId: string,
  userIds:  string[],
): Promise<PeerMap> {
  if (userIds.length === 0) return {}

  const admin = createAdminClient() as any
  const ids = Array.from(new Set(userIds))

  const [{ data: occupants }, { data: staff }] = await Promise.all([
    admin
      .from('occupants')
      .select(`
        user_id, first_name, last_name, room_id,
        rooms:rooms(room_number, block)
      `)
      .eq('tenant_id', tenantId)
      .in('user_id', ids),
    // No is_active filter — a deactivated staff member still has a name,
    // and a thread header reading "Member" is worse than showing it.
    admin
      .from('tenant_members')
      .select(`
        user_id, role,
        profile:staff_profiles(first_name, last_name, job_title, photo_url)
      `)
      .eq('tenant_id', tenantId)
      .in('user_id', ids),
  ])

  const map: PeerMap = {}

  for (const o of (occupants ?? []) as any[]) {
    const r = Array.isArray(o.rooms) ? o.rooms[0] : o.rooms
    const subtitle = r
      ? `Room ${r.room_number}${r.block ? ` · Block ${r.block}` : ''}`
      : 'Occupant'
    map[o.user_id] = {
      user_id:    o.user_id,
      display:    [o.first_name, o.last_name].filter(Boolean).join(' ') || 'Occupant',
      subtitle,
      kind:       'occupant',
      avatar_url: null,
    }
  }

  for (const s of (staff ?? []) as any[]) {
    if (map[s.user_id]) continue   // already named as occupant
    const profile = Array.isArray(s.profile) ? s.profile[0] : s.profile
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
    const roleLabel = titleCase(String(s.role).replace(/_/g, ' '))
    map[s.user_id] = {
      user_id:    s.user_id,
      display:    name || roleLabel,
      subtitle:   profile?.job_title ? `${profile.job_title} · ${roleLabel}` : roleLabel,
      kind:       'staff',
      avatar_url: profile?.photo_url ?? null,
    }
  }

  // Deeper fallback — anyone still unresolved (occupant row not linked to a
  // user_id, staff membership in another tenant, etc.). Resolve a real name
  // from the auth user's metadata / email instead of the generic "Member".
  const unresolved = ids.filter((id) => !map[id])
  for (const id of unresolved) {
    let display = 'Member'
    try {
      const { data } = await admin.auth.admin.getUserById(id)
      const u = data?.user
      const meta = (u?.user_metadata ?? {}) as Record<string, unknown>
      const metaName = [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim()
        || (typeof meta.full_name === 'string' ? meta.full_name : '')
        || (typeof meta.name === 'string' ? meta.name : '')
      if (metaName) {
        display = metaName
      } else if (u?.email) {
        // "kwame.mensah@x.com" → "Kwame Mensah"
        display = titleCase(u.email.split('@')[0].replace(/[._-]+/g, ' '))
      }
    } catch {
      // keep "Member"
    }
    map[id] = {
      user_id:    id,
      display,
      subtitle:   null,
      kind:       'unknown',
      avatar_url: null,
    }
  }

  return map
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}
