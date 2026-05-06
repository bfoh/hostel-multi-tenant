'use client'

import { useState, useRef } from 'react'
import { Send, Paperclip, Loader2, X } from 'lucide-react'

export function StaffMessageForm({ requestId }: { requestId: string }) {
  const [body, setBody]   = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim() && files.length === 0) return
    setErr(null); setBusy(true)
    const fd = new FormData()
    if (body.trim()) fd.set('body', body.trim())
    files.forEach(f => fd.append('files', f))
    const res = await fetch(`/api/maintenance/${requestId}/messages`, { method: 'POST', body: fd })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => null) as any
      setErr(j?.error ?? 'Send failed'); return
    }
    setBody(''); setFiles([])
    if (fileRef.current) fileRef.current.value = ''
  }

  const onPickFiles: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setFiles(Array.from(e.target.files ?? []).slice(0, 5))
  }

  return (
    <form onSubmit={submit} className="border-t border-slate-200 bg-white p-3">
      {err && <p className="mb-1.5 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">{err}</p>}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
              {f.name}
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
          <Paperclip className="h-4 w-4" />
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" hidden onChange={onPickFiles} />
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={1} maxLength={2000}
          placeholder="Reply to resident…"
          className="flex-1 resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
        <button type="submit" disabled={busy || (!body.trim() && files.length === 0)}
          className="rounded-full bg-emerald-600 p-2.5 text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </form>
  )
}
