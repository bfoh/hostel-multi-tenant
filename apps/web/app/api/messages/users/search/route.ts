/**
 * GET /api/messages/users/search?q=<text>&kind=staff|occupant|all
 *
 * Returns a small list of users in the current tenant matching the query
 * by name. Used by the "New message" picker. The current user is filtered
 * out. Occupant↔occupant search is hidden when the tenant disables
 * inter-occupant DMs.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveParticipantKind } from '@/lib/messages/server'

const LIMIT = 20

export async function GET(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q    = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const kind = (req.nextUrl.searchParams.get('kind') ?? 'all').toLowerCase()

  const admin = createAdminClient() as any

  // Caller's kind (staff / occupant) — used to gate occupant→occupant
  const meKind = await resolveParticipantKind(tenantId, user.id)

  let interOccDmEnabled = true
  if (meKind === 'occupant') {
    const { data: t } = await admin
      .from('tenants')
      .select('inter_occupant_dm_enabled')
      .eq('id', tenantId)
      .single()
    interOccDmEnabled = !!t?.inter_occupant_dm_enabled
  }

  const results: Array<{
    user_id: string
    display: string
    subtitle: string | null
    kind: 'staff' | 'occupant'
  }> = []

  // Staff search (always allowed)
  if (kind === 'all' || kind === 'staff') {
    let staffQ = admin
      .from('tenant_members')
      .select(`
        user_id, role,
        profile:staff_profiles(first_name, last_name, job_title, email)
      `)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .neq('user_id', user.id)
      .limit(LIMIT)

    if (q) {
      staffQ = staffQ.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`,
        { foreignTable: 'staff_profiles' } as any,
      )
    }

    const { data: staff, error: staffErr } = await staffQ
    if (staffErr) console.error('messages/users/search staff:', staffErr)
    for (const s of (staff ?? []) as any[]) {
      const profile = Array.isArray(s.profile) ? s.profile[0] : s.profile
      const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
      const roleLabel = titleCase(String(s.role).replace(/_/g, ' '))
      results.push({
        user_id:  s.user_id,
        display:  name || roleLabel,
        subtitle: profile?.job_title ? `${profile.job_title} · ${roleLabel}` : roleLabel,
        kind:     'staff',
      })
    }
  }

  // Occupant search (gated when caller is an occupant + tenant toggle off)
  const occupantSearchAllowed =
    kind === 'all' || kind === 'occupant'
      ? (meKind === 'staff' || (meKind === 'occupant' && interOccDmEnabled))
      : false

  if (occupantSearchAllowed) {
    let occQ = admin
      .from('occupants')
      .select('id, user_id, first_name, last_name, phone, status')
      .eq('tenant_id', tenantId)
      .not('user_id', 'is', null)
      .neq('user_id', user.id)
      .limit(LIMIT)

    if (q) {
      occQ = occQ.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`)
    }

    const { data: occs, error: occErr } = await occQ
    if (occErr) console.error('messages/users/search occupants:', occErr)

    const occIds = (occs ?? []).map((o: any) => o.id)
    const roomByOccId = new Map<string, { room_number: string; block: string | null }>()
    if (occIds.length) {
      const { data: bks } = await admin
        .from('bookings')
        .select('occupant_id, rooms:rooms(room_number, block)')
        .in('occupant_id', occIds)
        .in('status', ['checked_in', 'confirmed'])
      for (const b of (bks ?? []) as any[]) {
        const r = Array.isArray(b.rooms) ? b.rooms[0] : b.rooms
        if (r) roomByOccId.set(b.occupant_id, r)
      }
    }

    for (const o of (occs ?? []) as any[]) {
      const r = roomByOccId.get(o.id)
      const subtitle = r
        ? `Room ${r.room_number}${r.block ? ` · Block ${r.block}` : ''}`
        : (o.phone ? `Occupant · ${o.phone}` : 'Occupant')
      results.push({
        user_id:  o.user_id,
        display:  [o.first_name, o.last_name].filter(Boolean).join(' ') || 'Occupant',
        subtitle,
        kind:     'occupant',
      })
    }
  }

  // Dedup by user_id (someone could be both staff + occupant in edge cases)
  const seen = new Set<string>()
  const dedup = results.filter(r => (seen.has(r.user_id) ? false : (seen.add(r.user_id), true)))

  return NextResponse.json({ results: dedup.slice(0, LIMIT) })
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}
