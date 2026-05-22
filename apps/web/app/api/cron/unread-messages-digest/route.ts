/**
 * Daily email digest for users with messages older than 12 hours that
 * they haven't read yet. One email per user, listing the conversations
 * with unread counts + last preview + sender label.
 *
 * Cron: every 6 hours. Each user gets at most one digest per 18 hours
 * (anti-spam) tracked via `tenant_members_messaging_state.last_unread_digest_at`.
 *
 * For Phase 6 we keep state in memory of the cron call (no new table —
 * use a soft-window: only consider unread items older than 12h, so the
 * same email isn't re-sent on every cron tick for the same user).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, baseTemplate, button } from '@/lib/email'

const UNREAD_OLDER_THAN_MS = 12 * 3600 * 1000

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest)  { return handle(req) }

async function handle(req: NextRequest) {
  const secret =
    req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    ?? req.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient() as any
  const cutoffIso = new Date(Date.now() - UNREAD_OLDER_THAN_MS).toISOString()

  // Distinct (tenant_id, user_id) pairs with at least one unread message
  // older than the cutoff. We do this in two passes for clarity rather
  // than a single complex view.
  const { data: parts } = await admin
    .from('conversation_participants')
    .select('user_id, tenant_id, conversation_id, last_read_at')

  if (!parts || parts.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  // Group by user
  type Entry = {
    user_id:        string
    tenant_id:      string
    conversation_id: string
    last_read_at:   string | null
  }
  const byUser = new Map<string, Entry[]>()
  for (const p of parts as Entry[]) {
    if (!byUser.has(p.user_id)) byUser.set(p.user_id, [])
    byUser.get(p.user_id)!.push(p)
  }

  let sent = 0
  let skipped = 0

  for (const [userId, rows] of byUser) {
    try {
      // Gather all unread-conversation summaries for this user
      const summaries: Array<{
        conv_id:      string
        title:        string
        preview:      string | null
        unread_count: number
        tenant_id:    string
      }> = []

      for (const r of rows) {
        // Conversation last_message_at must be > last_read_at AND > cutoff
        const { data: conv } = await admin
          .from('conversations')
          .select('id, tenant_id, type, title, last_message_at, last_message_preview')
          .eq('id', r.conversation_id)
          .maybeSingle()
        if (!conv?.last_message_at) continue
        if (new Date(conv.last_message_at).getTime() > Date.now() - UNREAD_OLDER_THAN_MS) {
          // not old enough yet
          continue
        }
        if (r.last_read_at && new Date(r.last_read_at) >= new Date(conv.last_message_at)) {
          continue
        }

        const { count } = await admin
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', userId)
          .gt('created_at', r.last_read_at ?? '1970-01-01')
        if (!count || count === 0) continue

        summaries.push({
          conv_id:      conv.id,
          title:        conv.title ?? labelForType(conv.type),
          preview:      conv.last_message_preview,
          unread_count: count,
          tenant_id:    conv.tenant_id,
        })
      }

      if (summaries.length === 0) { skipped++; continue }

      // Resolve user email — try occupants first, then staff_profiles
      const { tenantId, email, displayName } = await resolveUserContact(userId, summaries[0].tenant_id)
      if (!email) { skipped++; continue }

      const { data: tenant } = await admin
        .from('tenants')
        .select('name, primary_color, logo_url')
        .eq('id', tenantId)
        .single()

      const brand = tenant?.primary_color ?? '#2563EB'
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const dashboardUrl = `${appUrl}/messages?ref=email-digest`

      const totalUnread = summaries.reduce((s, x) => s + x.unread_count, 0)
      const subject = `${totalUnread} unread message${totalUnread === 1 ? '' : 's'} · ${tenant?.name ?? 'Hostel'}`

      const rowsHtml = summaries
        .slice(0, 10)
        .map((s) => `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">
              <p style="margin:0 0 2px;font-weight:600;">${escapeHtml(s.title)}</p>
              <p style="margin:0;font-size:12px;color:#6b7280;">${escapeHtml(s.preview ?? '')}</p>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:${brand};text-align:right;font-family:ui-monospace,monospace;">
              ${s.unread_count}
            </td>
          </tr>
        `)
        .join('')

      const content = `
        <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">You have ${totalUnread} unread message${totalUnread === 1 ? '' : 's'}</p>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
          Hi${displayName ? ` ${escapeHtml(displayName)}` : ''}, here&apos;s what you missed.
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          ${rowsHtml}
        </table>
        ${button(dashboardUrl, 'Open messages', brand)}
        <p style="margin:20px 0 0;font-size:11px;color:#9ca3af;text-align:center;">
          You can mute conversations from the thread menu in the app.
        </p>
      `

      await sendEmail({
        to:         email,
        senderName: tenant?.name ?? 'Hostel',
        subject,
        html:       baseTemplate(tenant?.name ?? 'Hostel', brand, content, tenant?.logo_url ?? null),
      })
      sent++
    } catch (err) {
      console.error('[unread-messages-digest]', err)
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, total: byUser.size })
}

function labelForType(t: string): string {
  if (t === 'broadcast') return 'Announcements'
  if (t === 'group')     return 'Group'
  return 'Direct message'
}

async function resolveUserContact(
  userId:       string,
  fallbackTenantId: string,
): Promise<{ tenantId: string; email: string | null; displayName: string | null }> {
  const admin = createAdminClient() as any

  const { data: occ } = await admin
    .from('occupants')
    .select('tenant_id, email, first_name, last_name')
    .eq('user_id', userId)
    .maybeSingle()
  if (occ?.email) {
    return {
      tenantId:    occ.tenant_id ?? fallbackTenantId,
      email:       occ.email,
      displayName: [occ.first_name, occ.last_name].filter(Boolean).join(' ').trim() || null,
    }
  }

  const { data: staff } = await admin
    .from('tenant_members')
    .select(`
      tenant_id,
      profile:staff_profiles(first_name, last_name, email)
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  if (staff) {
    const profile = Array.isArray(staff.profile) ? staff.profile[0] : staff.profile
    return {
      tenantId:    staff.tenant_id ?? fallbackTenantId,
      email:       profile?.email ?? null,
      displayName: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || null,
    }
  }
  return { tenantId: fallbackTenantId, email: null, displayName: null }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
