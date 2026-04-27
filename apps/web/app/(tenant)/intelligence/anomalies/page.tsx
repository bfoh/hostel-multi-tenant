import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, AlertTriangle, AlertCircle, Info, Settings2 } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'

export const metadata: Metadata = { title: 'Anomaly Alerts' }

const SEVERITY_STYLE: Record<string, { icon: React.ElementType; cls: string; label: string }> = {
  critical: { icon: AlertCircle,   cls: 'text-danger bg-danger/10 border-danger/20',   label: 'Critical' },
  warning:  { icon: AlertTriangle, cls: 'text-warning bg-warning/10 border-warning/20', label: 'Warning'  },
  info:     { icon: Info,          cls: 'text-info bg-info/10 border-info/20',          label: 'Info'     },
}

export default async function AnomalyAlertsPage() {
  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id')

  const supabase = createAdminClient()

  const [{ data: alerts }, { data: rules }] = await Promise.all([
    supabase
      .from('anomaly_alerts')
      .select('*')
      .eq('tenant_id', tenantId ?? '')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('anomaly_rules')
      .select('*')
      .eq('tenant_id', tenantId ?? '')
      .order('created_at'),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/intelligence" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Intelligence</Link>
            <span className="text-text-disabled">/</span>
            <h1 className="text-xl font-semibold text-text-primary">Anomaly Alerts</h1>
          </div>
          <p className="mt-1 text-sm text-text-secondary">Automated detection of unusual patterns in revenue, occupancy, and payments.</p>
        </div>
      </div>

      {/* Rules status */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-text-tertiary" /> Active Rules
        </h2>
        {!rules || rules.length === 0 ? (
          <p className="text-xs text-text-tertiary">No rules configured. Run the migration to seed default rules.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(rules as any[]).map(r => {
              const style = SEVERITY_STYLE[r.severity as string] ?? SEVERITY_STYLE.info
              const Icon  = style.icon
              return (
                <div key={r.id} className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${r.is_enabled ? style.cls : 'text-text-tertiary bg-surface-raised border-border'}`}>
                  <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium">{r.name}</p>
                    <p className="text-[11px] opacity-70">Every {r.window_days}d · {r.is_enabled ? 'Enabled' : 'Paused'}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <p className="text-[11px] text-text-tertiary">
          Rules are evaluated every 15 minutes via <code className="font-mono">POST /api/cron/anomaly-check</code>.
          Set <code className="font-mono">CRON_SECRET</code> + configure Vercel Cron to automate.
        </p>
      </div>

      {/* Alert log */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Alert History</h2>

        {!alerts || alerts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-text-disabled mb-2" />
            <p className="text-sm font-medium text-text-primary">No alerts yet</p>
            <p className="text-xs text-text-secondary mt-1">Alerts will appear here when anomalies are detected.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(alerts as any[]).map(alert => {
              const style = SEVERITY_STYLE[alert.severity as string] ?? SEVERITY_STYLE.info
              const Icon  = style.icon
              return (
                <div key={alert.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${style.cls}`}>
                  <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.message}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs opacity-70">
                      <span className="capitalize">{alert.metric.replace('_', ' ')}</span>
                      <span>{new Date(alert.created_at).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      {alert.sms_sent && <span>SMS sent</span>}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${style.cls}`}>
                    {style.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
