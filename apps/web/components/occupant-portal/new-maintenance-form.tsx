'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, CheckCircle2,
  Droplets, Zap, Wind, Building2, Sofa, Cpu, Sparkles, Bug, Shield, MoreHorizontal,
} from 'lucide-react'
import { haptics } from '@/lib/native/haptics'

const CATEGORIES = [
  { value: 'plumbing',    label: 'Plumbing',     Icon: Droplets    },
  { value: 'electrical',  label: 'Electrical',   Icon: Zap         },
  { value: 'hvac',        label: 'HVAC / AC',    Icon: Wind        },
  { value: 'structural',  label: 'Structural',   Icon: Building2   },
  { value: 'furniture',   label: 'Furniture',    Icon: Sofa        },
  { value: 'appliance',   label: 'Appliance',    Icon: Cpu         },
  { value: 'cleaning',    label: 'Cleaning',     Icon: Sparkles    },
  { value: 'pest_control',label: 'Pest Control', Icon: Bug         },
  { value: 'security',    label: 'Security',     Icon: Shield      },
  { value: 'other',       label: 'Other',        Icon: MoreHorizontal },
]

const PRIORITIES = [
  { value: 'low',    label: 'Low',    desc: 'Minor inconvenience',     cls: 'border-slate-200 text-slate-600' },
  { value: 'medium', label: 'Medium', desc: 'Needs attention soon',    cls: 'border-blue-200 text-blue-600'   },
  { value: 'high',   label: 'High',   desc: 'Causing daily difficulty', cls: 'border-orange-200 text-orange-600' },
  { value: 'urgent', label: 'Urgent', desc: 'Safety or health risk',   cls: 'border-red-200 text-red-600'     },
]

export function NewMaintenanceForm({ color }: { color: string }) {
  const router = useRouter()

  const [category,    setCategory]    = useState('')
  const [priority,    setPriority]    = useState('medium')
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')
  const [done,        setDone]        = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!category) { setError('Please select a category.'); return }
    if (!title.trim()) { setError('Please enter a title.'); return }

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/occupant/maintenance', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title: title.trim(), category, priority, description: description.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit request')
      haptics.success()
      setDone(true)
      setTimeout(() => router.push('/occupant-portal/maintenance'), 2000)
    } catch (e: any) {
      setError(e.message)
      haptics.error()
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <div>
          <p className="text-base font-semibold text-emerald-800">Request submitted!</p>
          <p className="mt-1 text-sm text-emerald-600">Our team will attend to it shortly. Redirecting…</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">

      {/* Category grid */}
      <div>
        <p className="mb-2.5 text-sm font-semibold text-slate-700">Category <span className="text-red-500">*</span></p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {CATEGORIES.map(c => {
            const selected = category === c.value
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                  selected
                    ? 'border-transparent shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
                style={selected ? { borderColor: color, backgroundColor: `${color}12` } : {}}
              >
                <c.Icon
                  className="h-5 w-5"
                  style={{ color: selected ? color : '#94a3b8' }}
                  strokeWidth={selected ? 2.5 : 1.8}
                />
                <span
                  className="text-[10px] font-semibold leading-tight"
                  style={{ color: selected ? color : '#64748b' }}
                >
                  {c.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Priority */}
      <div>
        <p className="mb-2.5 text-sm font-semibold text-slate-700">Priority</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRIORITIES.map(p => {
            const selected = priority === p.value
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  selected ? 'border-transparent shadow-sm' : 'border-slate-200 bg-white'
                }`}
                style={selected ? { borderColor: color, backgroundColor: `${color}12` } : {}}
              >
                <p className="text-xs font-bold" style={{ color: selected ? color : '#334155' }}>{p.label}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">{p.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="title">
          Brief title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Tap leaking in bathroom"
          maxLength={200}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-colors focus:border-slate-400"
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="desc">
          Details <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="desc"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe the issue in more detail so we can prepare…"
          rows={4}
          maxLength={1000}
          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-colors focus:border-slate-400"
        />
        <p className="mt-1 text-right text-[10px] text-slate-400">{description.length}/1000</p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: color }}
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit request'}
      </button>
    </form>
  )
}
