import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { resolveAudience, type CampaignAudience, type CampaignChannel } from '@/lib/marketing/audience'
import { sendBulkSms } from '@/lib/sms'
import { sendEmail } from '@/lib/email'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { data: campaign } = await supabase
    .from('marketing_campaigns')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  if (campaign.status !== 'draft') {
    return NextResponse.json({ error: 'This campaign has already been sent' }, { status: 409 })
  }

  // Re-resolve fresh — occupants may have changed since the draft's own
  // dry-run count was computed, and this is the number actually sent to.
  const recipients = await resolveAudience(
    supabase, tenantId,
    campaign.audience as CampaignAudience,
    campaign.channel as CampaignChannel,
  )

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'No recipients match this audience right now' }, { status: 422 })
  }

  try {
    if (campaign.channel === 'sms') {
      await sendBulkSms(recipients, campaign.body)
    } else {
      const { data: tenant } = await supabase.from('tenants').select('name').eq('id', tenantId).single()
      const result = await sendEmail({
        to:         recipients,
        subject:    campaign.subject ?? campaign.name,
        html:       `<div style="white-space:pre-wrap;font-family:sans-serif;">${campaign.body}</div>`,
        senderName: tenant?.name,
      })
      if (!result.ok) throw new Error(result.error ?? 'Email send failed')
    }

    const { data: updated } = await supabase
      .from('marketing_campaigns')
      .update({ status: 'sent', sent_at: new Date().toISOString(), recipient_count: recipients.length })
      .eq('id', id)
      .select()
      .single()

    return NextResponse.json(updated)
  } catch (err) {
    await supabase.from('marketing_campaigns').update({ status: 'failed' }).eq('id', id)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Send failed' }, { status: 500 })
  }
}
