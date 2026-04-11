'use client'

import { useState } from 'react'
import { Loader2, ChevronDown } from 'lucide-react'

interface Request {
  id:          string
  title:       string
  category:    string
  priority:    string
  status:      string
  description: string | null
  created_at:  string
  rooms:       { room_number: string } | null
}

const PRIORITY_CLS: Record<string, string> = {
  urgent: 'text-red-600 bg-red-50 border-red-200',
  high:   'text-orange-600 bg-orange-50 border-orange-200',
  medium: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  low:    'text-slate-500 bg-slate-50 border-slate-200',
}

const STATUS_OPTIONS = [
  { value: 'open',        label: 'Open'        },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed'   },
]

const STATUS_CLS: Record<string, string> = {
  open:        'bg-red-50 text-red-700',
  in_progress: 'bg-blue-50 text-blue-700',
  completed:   'bg-emerald-50 text-emerald-700',
}

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function MaintenanceCard({ req, color }: { req: Request; color: string }) {
  const [status,   setStatus]  = useState(req.status)
  const [updating, setUpdating] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const room = req.rooms

  async function changeStatus(newStatus: string) {
    if (newStatus === status) return
    setUpdating(true)
    try {
      await fetch(`/api/maintenance/${req.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      })
      setStatus(newStatus)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-start gap-3 px-4 py-4 text-left"
      >
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white uppercase"
          style={{ backgroundColor: req.priority === 'urgent' ? '#ef4444' : req.priority === 'high' ? '#f97316' : color }}
        >
          {req.category.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 leading-snug">{req.title}</p>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {room && <span className="text-xs text-slate-500">Room {room.room_number}</span>}
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_CLS[req.priority] ?? PRIORITY_CLS.low}`}>
              {req.priority}
            </span>
            <span className="text-[10px] text-slate-400">{timeAgo(req.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_CLS[status] ?? STATUS_CLS.open}`}>
            {status.replace('_', ' ')}
          </span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-3">
          {req.description && (
            <p className="text-sm text-slate-600 leading-relaxed">{req.description}</p>
          )}
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-500">Update status</p>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => changeStatus(opt.value)}
                  disabled={updating || status === opt.value}
                  className={`flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-all disabled:cursor-default ${
                    status === opt.value
                      ? 'border-transparent text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                  style={status === opt.value ? { backgroundColor: color } : {}}
                >
                  {updating && status !== opt.value ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
