'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Clock, MapPin } from 'lucide-react'

interface Task {
  id:       string
  status:   string
  priority: string
  notes:    string | null
  due_date: string | null
  rooms:    { room_number: string; block: string | null } | null
}

const PRIORITY_CLS: Record<string, string> = {
  urgent: 'border-red-200 bg-red-50 text-red-700',
  high:   'border-orange-200 bg-orange-50 text-orange-700',
  medium: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  low:    'border-slate-200 bg-slate-50 text-slate-500',
}

export function TaskCard({ task, color }: { task: Task; color: string }) {
  const [status,   setStatus]  = useState(task.status)
  const [updating, setUpdating] = useState(false)

  const room = task.rooms

  async function markDone() {
    setUpdating(true)
    try {
      await fetch(`/api/housekeeping/tasks/${task.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'done' }),
      })
      setStatus('done')
    } finally {
      setUpdating(false)
    }
  }

  async function markInProgress() {
    setUpdating(true)
    try {
      await fetch(`/api/housekeeping/tasks/${task.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'in_progress' }),
      })
      setStatus('in_progress')
    } finally {
      setUpdating(false)
    }
  }

  const isDone = status === 'done'

  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm transition-opacity ${isDone ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {room && (
              <span className="flex items-center gap-1 text-sm font-bold text-slate-800">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                Room {room.room_number}{room.block ? ` · ${room.block}` : ''}
              </span>
            )}
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_CLS[task.priority] ?? PRIORITY_CLS.low}`}>
              {task.priority}
            </span>
            {status === 'in_progress' && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                In progress
              </span>
            )}
          </div>
          {task.notes && (
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{task.notes}</p>
          )}
          {task.due_date && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
              <Clock className="h-3 w-3" />
              Due {new Date(task.due_date).toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          )}
        </div>

        {/* Action buttons */}
        {!isDone && (
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              onClick={markDone}
              disabled={updating}
              className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: color }}
            >
              {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Done
            </button>
            {status === 'pending' && (
              <button
                onClick={markInProgress}
                disabled={updating}
                className="flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
              >
                Start
              </button>
            )}
          </div>
        )}
        {isDone && (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
        )}
      </div>
    </div>
  )
}
