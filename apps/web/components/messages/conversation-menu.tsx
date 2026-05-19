'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, BellOff, Bell, Archive, ArchiveRestore, Pin, PinOff, Loader2 } from 'lucide-react'

interface Props {
  conversationId: string
  state: {
    muted_until: string | null
    archived_at: string | null
    pinned_at:   string | null
  }
}

export function ConversationMenu({ conversationId, state }: Props) {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [busy, setBusy]     = useState(false)
  const [muted, setMuted]   = useState(!!state.muted_until && new Date(state.muted_until) > new Date())
  const [archived, setArch] = useState(!!state.archived_at)
  const [pinned, setPin]    = useState(!!state.pinned_at)

  async function act(body: Record<string, unknown>) {
    setBusy(true)
    try {
      await fetch(`/api/messages/conversations/${conversationId}/actions`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      router.refresh()
    } finally {
      setBusy(false); setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="rounded p-1.5 text-text-tertiary hover:bg-surface-raised"
        aria-label="Conversation menu"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
            <Item
              icon={pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              label={pinned ? 'Unpin' : 'Pin to top'}
              onClick={() => { setPin(!pinned); act({ pin: !pinned }) }}
            />
            <Item
              icon={muted ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              label={muted ? 'Unmute' : 'Mute 7 days'}
              onClick={() => { setMuted(!muted); act({ mute_days: muted ? 0 : 7 }) }}
            />
            <Item
              icon={archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              label={archived ? 'Unarchive' : 'Archive'}
              onClick={() => { setArch(!archived); act({ archive: !archived }) }}
            />
          </div>
        </>
      )}
    </div>
  )
}

function Item({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-raised transition-colors"
    >
      {icon}
      {label}
    </button>
  )
}
