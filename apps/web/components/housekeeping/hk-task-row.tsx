'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, Loader2, AlertTriangle } from 'lucide-react'

interface Task {
  id: string
  status: string
  priority: string
  due_by: string | null
  notes: string | null
  source: string
  rooms: { id: string; room_number: string; block: string | null } | null
  staff_profiles: { id: string; first_name: string; last_name: string } | null
}

const STATUS_OPTIONS = [
  { value: 'pending',     label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done',        label: 'Done' },
  { value: 'skipped',     label: 'Skip' },
]

const PRIORITY_ICON: Record<string, React.ReactNode> = {
  urgent: <AlertTriangle className="h-3.5 w-3.5 text-danger" />,
  high:   <AlertTriangle className="h-3.5 w-3.5 text-warning" />,
}

export function HkTaskRow({
  task,
  priorityStyle,
}: {
  task: Task
  priorityStyle: Record<string, string>
}) {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)

  async function updateStatus(newStatus: string) {
    setLoading(true)
    try {
      await fetch(`/api/housekeeping/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const room      = task.rooms
  const assignee  = task.staff_profiles
  const isOverdue = task.due_by && new Date(task.due_by) < new Date()

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Priority icon */}
      <div className="shrink-0">
        {PRIORITY_ICON[task.priority] ?? <Clock className="h-3.5 w-3.5 text-text-tertiary" />}
      </div>

      {/* Room + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm text-text-primary">
            Room {room?.room_number ?? '?'}{room?.block ? ` (${room.block})` : ''}
          </p>
          <span className={`text-xs font-medium capitalize ${priorityStyle[task.priority] ?? ''}`}>
            {task.priority}
          </span>
          {task.source === 'checkout' && (
            <span className="rounded-full bg-info/10 text-info text-[10px] font-medium px-1.5 py-0.5">
              Auto · checkout
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-text-tertiary mt-0.5 flex-wrap">
          {assignee && (
            <span>Assigned: {assignee.first_name} {assignee.last_name}</span>
          )}
          {task.due_by && (
            <span className={isOverdue ? 'text-danger font-medium' : ''}>
              Due: {new Date(task.due_by + 'T00:00:00').toLocaleDateString('en-GH', { dateStyle: 'medium' })}
              {isOverdue && ' — overdue!'}
            </span>
          )}
          {task.notes && <span className="truncate max-w-[200px]">{task.notes}</span>}
        </div>
      </div>

      {/* Status selector */}
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-text-tertiary shrink-0" />
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              disabled={task.status === opt.value}
              onClick={() => updateStatus(opt.value)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                task.status === opt.value
                  ? opt.value === 'done'
                    ? 'bg-success/20 text-success'
                    : opt.value === 'in_progress'
                      ? 'bg-info/20 text-info'
                      : 'bg-surface-raised text-text-secondary'
                  : 'border border-border text-text-tertiary hover:text-text-primary hover:bg-surface-raised'
              } disabled:cursor-default`}
            >
              {opt.value === 'done' ? <CheckCircle2 className="inline h-3 w-3 mr-0.5" /> : null}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
