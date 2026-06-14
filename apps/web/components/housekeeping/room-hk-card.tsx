'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck, Loader2, Search, AlertTriangle, SprayCan } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type HKStatus = 'clean' | 'dirty' | 'inspecting' | 'out_of_order'

const STATUS_CONFIG: Record<HKStatus, {
  label: string
  bg: string
  text: string
  border: string
  dot: string
  icon: React.ReactNode
}> = {
  clean: {
    label: 'Clean',
    bg: 'bg-success-subtle',
    text: 'text-success',
    border: 'border-success/20',
    dot: 'bg-success',
    icon: <SprayCan className="h-3.5 w-3.5" />,
  },
  dirty: {
    label: 'Dirty',
    bg: 'bg-warning-subtle',
    text: 'text-warning-fg',
    border: 'border-warning/20',
    dot: 'bg-warning',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  inspecting: {
    label: 'Inspecting',
    bg: 'bg-info-subtle',
    text: 'text-info',
    border: 'border-info/20',
    dot: 'bg-info',
    icon: <Search className="h-3.5 w-3.5" />,
  },
  out_of_order: {
    label: 'Out of Order',
    bg: 'bg-danger-subtle',
    text: 'text-danger',
    border: 'border-danger/20',
    dot: 'bg-danger',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
}

const NEXT_ACTIONS: Record<HKStatus, { status: HKStatus; label: string }[]> = {
  dirty:        [{ status: 'inspecting', label: 'Start cleaning' }, { status: 'out_of_order', label: 'Mark out of order' }],
  inspecting:   [{ status: 'clean', label: 'Mark clean' }, { status: 'dirty', label: 'Back to dirty' }],
  clean:        [{ status: 'dirty', label: 'Mark dirty' }, { status: 'inspecting', label: 'Inspect' }],
  out_of_order: [{ status: 'dirty', label: 'Ready to clean' }, { status: 'clean', label: 'Mark clean' }],
}

interface Props {
  room: {
    id: string
    room_number: string
    block: string | null
    floor: number | null
    status: string
    housekeeping_status: HKStatus
    last_cleaned_at: string | null
    last_inspected_at: string | null
    category: { name: string } | { name: string }[] | null
  }
}

export function RoomHKCard({ room }: Props) {
  const router = useRouter()
  const [hkStatus, setHkStatus] = useState<HKStatus>(room.housekeeping_status)
  const [loading, setLoading] = useState<string | null>(null)

  const cat = Array.isArray(room.category) ? room.category[0] : room.category
  const cfg = STATUS_CONFIG[hkStatus]
  const actions = NEXT_ACTIONS[hkStatus]

  async function updateStatus(newStatus: HKStatus) {
    setLoading(newStatus)
    const res = await fetch(`/api/rooms/${room.id}/housekeeping`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ housekeeping_status: newStatus }),
    })
    if (res.ok) {
      setHkStatus(newStatus)
      router.refresh()
    }
    setLoading(null)
  }

  return (
    <div className={`rounded-xl border ${cfg.border} bg-surface p-4 space-y-3`}>
      {/* Room info */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-text-primary">
            Room {room.room_number}
            {room.block ? ` · Block ${room.block}` : ''}
          </p>
          <p className="text-xs text-text-tertiary mt-0.5">
            {cat?.name ?? 'Standard'}
            {room.floor != null ? ` · Floor ${room.floor}` : ''}
          </p>
        </div>
        {/* Occupancy dot */}
        <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
          room.status === 'occupied' ? 'bg-success' :
          room.status === 'reserved' ? 'bg-warning' : 'bg-border'
        }`} title={room.status} />
      </div>

      {/* HK status badge */}
      <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
        {cfg.icon}
        {cfg.label}
      </div>

      {/* Last cleaned / inspected */}
      <div className="space-y-0.5">
        {room.last_cleaned_at && (
          <p className="text-[11px] text-text-tertiary flex items-center gap-1">
            <CheckCheck className="h-3 w-3" />
            Cleaned {formatDate(room.last_cleaned_at)}
          </p>
        )}
        {room.last_inspected_at && (
          <p className="text-[11px] text-text-tertiary flex items-center gap-1">
            <Search className="h-3 w-3" />
            Inspected {formatDate(room.last_inspected_at)}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {actions.map((a) => (
          <button
            key={a.status}
            disabled={!!loading}
            onClick={() => updateStatus(a.status)}
            className="flex-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-raised transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {loading === a.status ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}
