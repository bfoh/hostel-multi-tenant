'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, FileText, X, Camera } from 'lucide-react'
import { useNativeCamera } from '@/lib/native/use-camera'
import { haptics } from '@/lib/native/haptics'

interface Props {
  bookingId:     string
  defaultAmount: number   // pesewas
  defaultBank:   string
  color:         string
}

function ghsString(pesewas: number) {
  return (pesewas / 100).toFixed(2)
}
function pesewasFromInput(input: string): number {
  // Accepts "3,600", "3600.50", "3,600.5"
  const cleaned = input.replace(/[^0-9.]/g, '')
  const cedis   = parseFloat(cleaned)
  if (Number.isNaN(cedis) || cedis <= 0) return 0
  return Math.round(cedis * 100)
}

export function DraftUploadForm({ bookingId, defaultAmount, defaultBank, color }: Props) {
  const router = useRouter()
  const [file,         setFile]         = useState<File | null>(null)
  const [amountInput,  setAmountInput]  = useState(ghsString(defaultAmount))
  const [draftNumber,  setDraftNumber]  = useState('')
  const [bankName,     setBankName]     = useState(defaultBank)
  const [depositDate,  setDepositDate]  = useState(() => new Date().toISOString().slice(0, 10))
  const [note,         setNote]         = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const amountPesewas = pesewasFromInput(amountInput)
  const ready = !!file && amountPesewas > 0 && draftNumber.length > 0 && bankName.length > 1 && /^\d{4}-\d{2}-\d{2}$/.test(depositDate)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready || !file) return
    setSubmitting(true); setError(null)

    const fd = new FormData()
    fd.append('booking_id',   bookingId)
    fd.append('amount',       String(amountPesewas))
    fd.append('draft_number', draftNumber)
    fd.append('bank_name',    bankName)
    fd.append('deposit_date', depositDate)
    if (note) fd.append('note', note)
    fd.append('file',         file)

    try {
      const res  = await fetch('/api/occupant/bank-draft', { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Submission failed')
      haptics.success()
      router.refresh()
    } catch (e: any) {
      setError(e.message)
      haptics.error()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 px-5 pb-4 pt-2">
      <FilePicker file={file} setFile={setFile} setError={setError} />

      <div className="grid grid-cols-2 gap-2">
        <Field label="Amount (GH₵)">
          <input
            inputMode="decimal"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono"
            value={amountInput}
            onChange={e => setAmountInput(e.target.value)}
          />
        </Field>
        <Field label="Draft #">
          <input
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono"
            value={draftNumber}
            onChange={e => setDraftNumber(e.target.value)}
            maxLength={40}
          />
        </Field>
        <Field label="Bank">
          <input
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            value={bankName}
            onChange={e => setBankName(e.target.value)}
            maxLength={120}
          />
        </Field>
        <Field label="Deposit date">
          <input
            type="date"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            value={depositDate}
            onChange={e => setDepositDate(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Note (optional)">
        <input
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={140}
          placeholder="e.g. 1st semester room fees"
        />
      </Field>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!ready || submitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-50"
        style={{ backgroundColor: color }}
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Submit for verification
      </button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function FilePicker({
  file, setFile, setError,
}: { file: File | null; setFile: (f: File | null) => void; setError: (s: string | null) => void }) {
  const { isNative, takePhoto } = useNativeCamera()

  async function snap() {
    const f = await takePhoto()
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { setError('Photo is larger than 5 MB'); return }
    setError(null)
    setFile(f)
  }

  return (
    <div className="space-y-2">
      {isNative && !file && (
        <button
          type="button"
          onClick={snap}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          <Camera className="h-4 w-4" />
          Take photo of draft
        </button>
      )}

      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-5 text-center hover:border-slate-400">
        {file ? (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-700">
            <FileText className="h-4 w-4" />
            <span className="truncate">{file.name}</span>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setFile(null) }}
              className="rounded p-1 hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5 text-slate-500" />
            </button>
          </div>
        ) : (
          <>
            <FileText className="mx-auto h-6 w-6 text-slate-400" />
            <p className="mt-1 text-xs font-medium text-slate-600">
              {isNative ? 'Or upload PDF / image' : 'Tap to upload draft'}
            </p>
            <p className="text-[10px] text-slate-400">PDF / JPG / PNG / HEIC · max 5 MB</p>
          </>
        )}
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/heic,image/heic-sequence"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0] ?? null
            if (f && f.size > 5 * 1024 * 1024) {
              setError('File is larger than 5 MB')
              return
            }
            setError(null)
            setFile(f)
          }}
        />
      </label>
    </div>
  )
}
