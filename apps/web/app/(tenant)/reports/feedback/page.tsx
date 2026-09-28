import type { Metadata } from 'next'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FeedbackReviewActions } from '@/components/reports/feedback-review-actions'

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-warning-subtle text-warning-fg',
  approved: 'bg-success-subtle text-success',
  rejected: 'bg-danger-subtle text-danger',
}

export const metadata: Metadata = { title: 'Occupant Feedback' }

function Stars({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-border'}`} />
      ))}
    </span>
  )
}

export default async function FeedbackPage() {
  const supabase = await createTenantAdminClientFromHeaders()
  const { data: rows } = await supabase
    .from('occupant_feedback')
    .select('*, bookings(booking_ref, check_in_date, check_out_date, occupants(first_name, last_name))')
    .order('submitted_at', { ascending: false })
    .limit(200)

  const feedback = rows ?? []
  const avg = (key: string) => {
    const vals = feedback.map((f: any) => f[key]).filter(Boolean)
    return vals.length ? (vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(1) : '—'
  }

  const overall     = avg('overall_rating')
  const cleanliness = avg('cleanliness_rating')
  const staff       = avg('staff_rating')
  const value       = avg('value_rating')
  const recPct = feedback.length
    ? Math.round((feedback.filter((f: any) => f.would_recommend).length / feedback.length) * 100)
    : 0
  const pendingCount = feedback.filter((f: any) => f.status === 'pending').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text-primary">
          Occupant Feedback
          {pendingCount > 0 && (
            <span className="rounded-full bg-warning-subtle px-2.5 py-0.5 text-xs font-semibold text-warning-fg">
              {pendingCount} pending review{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
        </h1>
        <p className="mt-0.5 text-sm text-text-secondary">{feedback.length} review{feedback.length !== 1 ? 's' : ''} collected</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: 'Overall',     value: overall },
          { label: 'Cleanliness', value: cleanliness },
          { label: 'Staff',       value: staff },
          { label: 'Value',       value: value },
          { label: 'Recommend',   value: `${recPct}%` },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-text-primary">{kpi.value}</p>
              <p className="text-xs text-text-tertiary mt-0.5">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* List */}
      <Card>
        <CardHeader><CardTitle>All reviews</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {feedback.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-tertiary">No feedback submitted yet</p>
          ) : (
            <div className="divide-y divide-border">
              {feedback.map((f: any) => {
                const booking = Array.isArray(f.bookings) ? f.bookings[0] : f.bookings
                const occ = booking ? (Array.isArray(booking.occupants) ? booking.occupants[0] : booking.occupants) : null
                return (
                  <div key={f.id} className="py-4 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-text-primary">
                            {occ ? `${occ.first_name} ${occ.last_name}` : 'Anonymous'}
                          </p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_BADGE[f.status] ?? ''}`}>
                            {f.status}
                          </span>
                          {f.featured && (
                            <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-fg">
                              Featured
                            </span>
                          )}
                        </div>
                        {booking && (
                          <p className="ref-number text-xs text-text-disabled">{booking.booking_ref}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Stars rating={f.overall_rating} />
                        <span className="text-sm font-semibold text-text-primary">{f.overall_rating}/5</span>
                      </div>
                    </div>

                    {/* Sub-ratings */}
                    <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
                      {f.cleanliness_rating && (
                        <span className="flex items-center gap-1">Cleanliness: <Stars rating={f.cleanliness_rating} /></span>
                      )}
                      {f.staff_rating && (
                        <span className="flex items-center gap-1">Staff: <Stars rating={f.staff_rating} /></span>
                      )}
                      {f.value_rating && (
                        <span className="flex items-center gap-1">Value: <Stars rating={f.value_rating} /></span>
                      )}
                      {f.would_recommend != null && (
                        <span className={f.would_recommend ? 'text-success' : 'text-danger'}>
                          {f.would_recommend ? '✓ Would recommend' : '✗ Would not recommend'}
                        </span>
                      )}
                    </div>

                    {f.comments && (
                      <p className="text-sm text-text-secondary italic">"{f.comments}"</p>
                    )}
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs text-text-disabled">
                        {new Date(f.submitted_at).toLocaleDateString('en-GH', { dateStyle: 'medium' })}
                      </p>
                      <FeedbackReviewActions feedbackId={f.id} status={f.status} featured={f.featured} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
