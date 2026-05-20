/**
 * SMS notification for new website enquiries — delivered to the tenant's
 * primary contact phone (tenants.contact_phone). Uses the tenant-scoped
 * Arkesel sender ID (tenants.sms_sender_id) when set, falling back to the
 * platform default.
 *
 * Kept separate from lib/sms.ts because that module's templates target
 * occupants and run through the notification_templates rendering pipeline;
 * enquiries go to staff and don't need user-editable copy.
 */

import { createAdminClient } from '@/lib/supabase/admin'

const ARKESEL_BASE = 'https://sms.arkesel.com/api/v2/sms/send'

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 10) return `233${digits.slice(1)}`
  if (digits.startsWith('233')) return digits
  return digits
}

export async function notifyEnquirySms(args: {
  tenantId:       string
  tenantName:     string
  toPhone:        string
  enquirerName:   string
  enquirerPhone:  string
  roomOfInterest: string | null
}): Promise<void> {
  if (!process.env.ARKESEL_API_KEY) {
    console.info('[enquiry-sms] ARKESEL_API_KEY missing — skipped')
    return
  }

  const admin = createAdminClient()
  const { data: tenant } = await (admin
    .from('tenants') as any)
    .select('sms_sender_id')
    .eq('id', args.tenantId)
    .single()

  const sender =
    (tenant?.sms_sender_id as string | undefined)?.trim() ||
    process.env.ARKESEL_SENDER_ID ||
    'GH Hostels'

  const room = args.roomOfInterest ? ` (${args.roomOfInterest})` : ''
  const message =
    `${args.tenantName}: new website enquiry from ${args.enquirerName}` +
    `${room}. Call ${args.enquirerPhone}. Open dashboard → Waiting List.`

  try {
    const res = await fetch(ARKESEL_BASE, {
      method: 'POST',
      headers: {
        'api-key':     process.env.ARKESEL_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender,
        message:    message.slice(0, 320),
        recipients: [formatPhone(args.toPhone)],
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[enquiry-sms] Arkesel error:', res.status, text)
    }
  } catch (err) {
    console.error('[enquiry-sms] network error:', err)
  }
}
