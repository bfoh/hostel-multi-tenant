import Link from 'next/link'
import { getSetupChecklist } from '@/lib/data/dashboard'

export async function SetupChecklist() {
  const status = await getSetupChecklist()

  const steps = [
    {
      key: 'hasCategory',
      done: status.hasCategory,
      label: 'Create a room category',
      description: 'Define room types and their rates (e.g. Single, Double, Suite).',
      href: '/rooms/categories/new',
      cta: 'Add category',
    },
    {
      key: 'hasRoom',
      done: status.hasRoom,
      label: 'Add your first room',
      description: 'Register a room number and assign it to a category.',
      href: '/rooms/new',
      cta: 'Add room',
    },
    {
      key: 'hasOccupant',
      done: status.hasOccupant,
      label: 'Register an occupant',
      description: 'Add a resident, student, or guest to your records.',
      href: '/occupants/new',
      cta: 'Add occupant',
    },
    {
      key: 'hasBooking',
      done: status.hasBooking,
      label: 'Create your first booking',
      description: 'Assign an occupant to a room and record the payment.',
      href: '/bookings/new',
      cta: 'Create booking',
    },
  ]

  const completedCount = steps.filter((s) => s.done).length

  // Hide once everything is done
  if (completedCount === steps.length) return null

  const pct = Math.round((completedCount / steps.length) * 100)

  return (
    <div className="rounded-xl border border-brand/20 bg-brand/5 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            Set up your hostel
          </h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            Complete these steps to start managing bookings.
          </p>
        </div>
        <span className="shrink-0 text-sm font-medium text-brand">
          {completedCount}/{steps.length} done
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-brand/15">
        <div
          className="h-1.5 rounded-full bg-brand transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Steps */}
      <ol className="space-y-3">
        {steps.map((step, idx) => (
          <li key={step.key} className="flex items-start gap-3">
            {/* Circle indicator */}
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors
              border-brand bg-brand text-brand-fg"
              style={step.done ? {} : { background: 'transparent', borderColor: 'hsl(var(--color-border))' }}
            >
              {step.done ? (
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span className="text-[10px] font-bold text-text-tertiary">{idx + 1}</span>
              )}
            </div>

            <div className="flex flex-1 items-start justify-between gap-3 min-w-0">
              <div className="min-w-0">
                <p className={`text-sm font-medium ${step.done ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                  {step.label}
                </p>
                {!step.done && (
                  <p className="text-xs text-text-secondary mt-0.5">{step.description}</p>
                )}
              </div>
              {!step.done && (
                <Link
                  href={step.href}
                  className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
                >
                  {step.cta}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
