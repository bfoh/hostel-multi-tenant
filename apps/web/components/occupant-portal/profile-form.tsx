'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, Pencil, X } from 'lucide-react'

interface ProfileData {
  first_name:  string
  last_name:   string
  phone:       string
  institution: string | null
  programme:   string | null
  student_id:  string | null
}

export function ProfileForm({ initial, color }: { initial: ProfileData; color: string }) {
  const [editing, setEditing] = useState(false)
  const [data,    setData]    = useState(initial)
  const [draft,   setDraft]   = useState(initial)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [saved,   setSaved]   = useState(false)

  function startEdit() {
    setDraft(data)
    setEditing(true)
    setError('')
    setSaved(false)
  }

  function cancel() {
    setEditing(false)
    setError('')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/occupant/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          first_name:  draft.first_name.trim(),
          last_name:   draft.last_name.trim(),
          phone:       draft.phone.trim(),
          institution: draft.institution?.trim() || null,
          programme:   draft.programme?.trim() || null,
          student_id:  draft.student_id?.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Failed to save')
      setData(draft)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const fields: { key: keyof ProfileData; label: string; type?: string; required?: boolean }[] = [
    { key: 'first_name',  label: 'First name',  required: true },
    { key: 'last_name',   label: 'Last name',   required: true },
    { key: 'phone',       label: 'Phone',       type: 'tel', required: true },
    { key: 'institution', label: 'Institution / School' },
    { key: 'programme',   label: 'Programme / Course' },
    { key: 'student_id',  label: 'Student ID' },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-slate-800">Personal Information</h2>
        {!editing ? (
          <button
            onClick={startEdit}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        ) : (
          <button onClick={cancel} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        )}
      </div>

      {saved && (
        <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-5 py-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <p className="text-xs font-medium text-emerald-700">Profile updated successfully!</p>
        </div>
      )}

      {editing ? (
        <form onSubmit={save} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {fields.map(f => (
              <div key={f.key} className={f.key === 'phone' || f.key === 'student_id' ? 'col-span-2 sm:col-span-1' : ''}>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  {f.label}
                  {f.required && <span className="text-red-400"> *</span>}
                </label>
                <input
                  type={f.type ?? 'text'}
                  value={(draft[f.key] as string) ?? ''}
                  onChange={e => setDraft(prev => ({ ...prev, [f.key]: e.target.value }))}
                  required={f.required}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400 focus:bg-white"
                />
              </div>
            ))}
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: color }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
          </button>
        </form>
      ) : (
        <div className="divide-y divide-slate-100">
          {fields.map(f => (
            <div key={f.key} className="flex items-center justify-between px-5 py-3.5">
              <p className="text-xs text-slate-400">{f.label}</p>
              <p className="text-sm font-medium text-slate-800 text-right max-w-[60%]">
                {(data[f.key] as string) || <span className="text-slate-300 italic">Not set</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
