'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Loader2, CheckCircle2 } from 'lucide-react'

export function RunNowButton({ scheduleId }: { scheduleId: string }) {
  const router  = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [msg,   setMsg]   = useState('')

  async function run() {
    setState('loading')
    setMsg('')
    try {
      const res  = await fetch(`/api/pm-schedules/${scheduleId}/run`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setState('done')
      setMsg('Work order created')
      router.refresh()
      setTimeout(() => setState('idle'), 3000)
    } catch (e: any) {
      setState('error')
      setMsg(e.message)
      setTimeout(() => setState('idle'), 4000)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={run}
        disabled={state === 'loading' || state === 'done'}
        className="flex items-center gap-2 rounded-xl border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/5 transition-colors disabled:opacity-50"
      >
        {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : state === 'done' ? <CheckCircle2 className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {state === 'loading' ? 'Creating…' : state === 'done' ? 'Done' : 'Run now'}
      </button>
      {msg && (
        <p className={`text-xs ${state === 'error' ? 'text-danger' : 'text-success'}`}>{msg}</p>
      )}
    </div>
  )
}
