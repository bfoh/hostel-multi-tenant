import { NextResponse } from 'next/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

// POST /api/report-schedules/run
// Called by a cron job (e.g. Vercel Cron / Supabase Edge Functions scheduler)
// Sends due reports and updates next_run_at
export async function POST(req: Request) {
  // Simple secret check — set CRON_SECRET in env
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createTenantAdminClientFromHeaders()
  const now = new Date().toISOString()

  const { data: due } = await supabase
    .from('report_schedules')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_at', now)

  if (!due || due.length === 0) return NextResponse.json({ ran: 0 })

  let ran = 0

  for (const schedule of due) {
    try {
      // Fetch CSV data from the export API using admin client
      const today = new Date().toISOString().slice(0, 10)
      const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

      const { data: rows } = await supabase
        .from(schedule.report_type === 'bookings' ? 'bookings'
            : schedule.report_type === 'occupants' ? 'occupants'
            : schedule.report_type === 'payments' ? 'booking_payments'
            : schedule.report_type === 'maintenance' ? 'maintenance_requests'
            : 'expenses')
        .select('*')
        .eq('tenant_id', schedule.tenant_id)
        .gte('created_at', thirtyAgo)
        .lte('created_at', today)
        .limit(5000)

      // Convert to CSV
      const csv = rows && rows.length > 0
        ? [Object.keys(rows[0]).join(','),
           ...rows.map((r) => Object.values(r).map((v) => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`).join(','))
          ].join('\n')
        : 'No data'

      // Send email (Arkesel email or similar — log if not configured)
      if (process.env.ARKESEL_API_KEY) {
        const subject = `${schedule.name} — ${today}`
        for (const recipient of schedule.recipients) {
          await fetch('https://email.arkesel.com/api/v1/email/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-key': process.env.ARKESEL_API_KEY,
            },
            body: JSON.stringify({
              sender: process.env.EMAIL_FROM ?? 'reports@hostel.app',
              recipients: [recipient],
              subject,
              text: `Please find the ${schedule.report_type} report attached.\n\n${csv.substring(0, 2000)}${csv.length > 2000 ? '\n... (truncated, full data in CSV)' : ''}`,
            }),
          })
        }
      } else {
        console.log(`[report-schedules/run] Would email ${schedule.recipients.join(', ')} — ${schedule.name}`)
      }

      // Compute next_run_at
      const nextRun = new Date()
      if (schedule.frequency === 'daily') {
        nextRun.setDate(nextRun.getDate() + 1)
      } else if (schedule.frequency === 'weekly') {
        nextRun.setDate(nextRun.getDate() + 7)
      } else {
        nextRun.setMonth(nextRun.getMonth() + 1)
      }
      nextRun.setHours(6, 0, 0, 0)

      await supabase
        .from('report_schedules')
        .update({ last_sent_at: now, next_run_at: nextRun.toISOString() })
        .eq('id', schedule.id)

      ran++
    } catch (err) {
      console.error(`[report-schedules/run] Error for schedule ${schedule.id}:`, err)
    }
  }

  return NextResponse.json({ ran })
}
