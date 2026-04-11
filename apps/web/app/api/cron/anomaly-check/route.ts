import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { detectAnomalies, saveAnomalyAlerts } from '@/lib/anomaly-detector'
import { sendPushToTenant } from '@/lib/push'

/**
 * POST /api/cron/anomaly-check
 * Intended to be called by Vercel Cron (every 15 min) or manually.
 * Authenticated via CRON_SECRET env var.
 *
 * Vercel cron.json:
 * { "crons": [{ "path": "/api/cron/anomaly-check", "schedule": "0,15,30,45 * * * *" }] }
 */
export async function POST(req: NextRequest) {
  // Validate cron secret
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Fetch all active tenants
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, contact_phone')
    .eq('is_active', true)

  if (!tenants || tenants.length === 0) {
    return NextResponse.json({ ok: true, checked: 0 })
  }

  let totalAlerts = 0

  for (const tenant of tenants) {
    const anomalies = await detectAnomalies(tenant.id)
    if (anomalies.length === 0) continue

    await saveAnomalyAlerts(anomalies)
    totalAlerts += anomalies.length

    // Send push notifications for critical/warning anomalies
    const criticals = anomalies.filter(a => a.severity === 'critical')
    const warnings  = anomalies.filter(a => a.severity === 'warning')

    if (criticals.length > 0 || warnings.length > 0) {
      const topAlert = criticals[0] ?? warnings[0]
      const count = criticals.length + warnings.length
      sendPushToTenant(tenant.id, {
        title: `⚠️ ${count} anomal${count === 1 ? 'y' : 'ies'} — ${tenant.name}`,
        body:  topAlert.message + (count > 1 ? ` (+${count - 1} more)` : ''),
        url:   '/intelligence/anomalies',
        tag:   `anomaly-${tenant.id}`,
      }).catch(() => {})
    }

    // Send SMS to owner for critical/warning anomalies
    if (tenant.contact_phone) {
      if (criticals.length > 0 || warnings.length > 0) {
        const lines = [
          `⚠️ GH Hostels Alert — ${tenant.name}`,
          ...criticals.map(a => `🔴 ${a.message}`),
          ...warnings.map(a  => `🟡 ${a.message}`),
          'Log in to view details.',
        ]

        const smsBody = lines.join('\n').slice(0, 600) // SMS length cap

        // Send via Arkesel (non-blocking)
        sendSmsAlert(tenant.contact_phone, smsBody).catch(() => {})

        // Mark alerts as SMS-sent
        await supabase
          .from('anomaly_alerts')
          .update({ sms_sent: true, sms_sent_at: new Date().toISOString() })
          .eq('tenant_id', tenant.id)
          .eq('sms_sent', false)
      }
    }
  }

  return NextResponse.json({ ok: true, checked: tenants.length, alerts: totalAlerts })
}

async function sendSmsAlert(phone: string, message: string) {
  const apiKey = process.env.ARKESEL_API_KEY
  if (!apiKey) return

  await fetch('https://sms.arkesel.com/sms/api', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: 'GH Hostels',
      message,
      recipients: [phone.replace(/\D/g, '').replace(/^0/, '233')],
    }),
  })
}
