import { AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export async function AlertsCard() {
  // TODO: fetch real alerts (overdue payments, maintenance requests, etc.)
  const count = 0

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-text-secondary">Alerts</p>
            <p className="mt-1 font-display text-3xl font-bold text-text-primary tabular-nums">
              {count}
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              {count === 0 ? 'All clear' : `${count} need attention`}
            </p>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${count > 0 ? 'bg-danger-subtle' : 'bg-surface-sunken'}`}>
            <AlertTriangle className={`h-5 w-5 ${count > 0 ? 'text-danger' : 'text-text-disabled'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
