'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, XCircle, Loader2, Download } from 'lucide-react'

interface Category { id: string; name: string }

interface ValidRow {
  room_number: string; category_id: string; floor: number | null; block: string | null; status: string; notes: string | null
}

interface ImportError { row: number; message: string }

const TEMPLATE_CSV = `room_number,category_name,floor,block,status,notes
101,Single Room,1,A,available,
102,Single Room,1,A,available,
201,Double Room,2,B,available,Near study hall
202,Double Room,2,B,maintenance,Being repainted`

const STATUSES = ['available', 'occupied', 'reserved', 'maintenance', 'inactive']

export function RoomImportClient({ categories }: { categories: Category[] }) {
  const [file, setFile]         = useState<File | null>(null)
  const [preview, setPreview]   = useState<ValidRow[] | null>(null)
  const [errors, setErrors]     = useState<ImportError[]>([])
  const [importing, setImporting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [result, setResult]     = useState<{ imported: number } | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const catMap = new Map(categories.map((c) => [c.id, c.name]))

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'rooms_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function runPreview() {
    if (!file) return
    setPreviewing(true); setErrors([]); setPreview(null); setServerError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('dry_run', 'true')
      const res = await fetch('/api/rooms/import', { method: 'POST', body: form })
      const data = await res.json()
      if (res.status === 422) { setErrors(data.errors ?? []); return }
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setPreview(data.rows ?? [])
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setPreviewing(false)
    }
  }

  async function runImport() {
    if (!file) return
    setImporting(true); setServerError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/rooms/import', { method: 'POST', body: form })
      const data = await res.json()
      if (res.status === 422) { setErrors(data.errors ?? []); setPreview(null); return }
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setResult({ imported: data.imported })
      setPreview(null)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setImporting(false)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f); setPreview(null); setErrors([]); setResult(null); setServerError(null)
  }

  return (
    <div className="space-y-6">
      {/* Template download + format info */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-text-primary text-sm">CSV Format</h2>
            <p className="text-xs text-text-secondary mt-1">
              Required columns: <code className="font-mono bg-surface-raised px-1 rounded">room_number</code>,{' '}
              <code className="font-mono bg-surface-raised px-1 rounded">category_name</code>.{' '}
              Optional: <code className="font-mono bg-surface-raised px-1 rounded">floor</code>,{' '}
              <code className="font-mono bg-surface-raised px-1 rounded">block</code>,{' '}
              <code className="font-mono bg-surface-raised px-1 rounded">status</code>,{' '}
              <code className="font-mono bg-surface-raised px-1 rounded">notes</code>.
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              Status values: {STATUSES.join(', ')}
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:bg-surface-raised transition-colors"
          >
            <Download className="h-4 w-4" /> Template
          </button>
        </div>

        {/* Available categories */}
        <div>
          <p className="text-xs font-medium text-text-tertiary mb-2">Your room categories</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <span key={c.id} className="rounded-full border border-border bg-surface-raised px-2.5 py-0.5 text-xs text-text-secondary font-mono">
                {c.name}
              </span>
            ))}
            {categories.length === 0 && <p className="text-xs text-text-disabled italic">No categories yet — create one first</p>}
          </div>
        </div>
      </div>

      {/* File picker */}
      <div
        onClick={() => fileRef.current?.click()}
        className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface-raised py-10 text-center hover:border-brand/40 hover:bg-surface transition-colors"
      >
        <Upload className="h-10 w-10 text-text-disabled" />
        <div>
          <p className="font-medium text-text-primary text-sm">{file ? file.name : 'Click to upload CSV'}</p>
          <p className="text-xs text-text-tertiary mt-0.5">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'CSV files only, max 500 rows'}</p>
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFileChange} className="hidden" />
      </div>

      {file && !preview && (
        <button
          onClick={runPreview}
          disabled={previewing}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand bg-brand-subtle px-4 py-3 text-sm font-medium text-brand hover:bg-brand-subtle/80 transition-colors disabled:opacity-60"
        >
          {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Preview import
        </button>
      )}

      {serverError && (
        <p className="rounded-lg bg-danger-subtle border border-danger/20 px-4 py-3 text-sm text-danger">{serverError}</p>
      )}

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="rounded-xl border border-danger/20 bg-danger-subtle p-4 space-y-2">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-danger" />
            <p className="text-sm font-semibold text-danger">{errors.length} error{errors.length > 1 ? 's' : ''} found — fix and re-upload</p>
          </div>
          <ul className="space-y-1 text-xs text-danger">
            {errors.map((e, i) => (
              <li key={i}>Row {e.row}: {e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview table */}
      {preview && preview.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <p className="text-sm font-semibold text-success">{preview.length} room{preview.length > 1 ? 's' : ''} ready to import</p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-raised">
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-tertiary">Room #</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-tertiary">Category</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-tertiary">Floor</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-tertiary">Block</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-tertiary">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.slice(0, 20).map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 font-mono text-xs text-text-primary">{r.room_number}</td>
                    <td className="px-4 py-2 text-text-secondary">{catMap.get(r.category_id) ?? r.category_id}</td>
                    <td className="px-4 py-2 text-text-secondary">{r.floor ?? '—'}</td>
                    <td className="px-4 py-2 text-text-secondary">{r.block ?? '—'}</td>
                    <td className="px-4 py-2 capitalize text-text-secondary">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 20 && (
              <p className="px-4 py-2 text-xs text-text-tertiary border-t border-border">
                … and {preview.length - 20} more rows
              </p>
            )}
          </div>
          <button
            onClick={runImport}
            disabled={importing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import {preview.length} rooms
          </button>
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="rounded-xl border border-success/30 bg-success-subtle p-6 text-center space-y-2">
          <CheckCircle className="mx-auto h-10 w-10 text-success" />
          <p className="font-semibold text-success text-lg">{result.imported} rooms imported</p>
          <p className="text-sm text-text-secondary">Existing rooms with the same number were updated.</p>
          <button
            onClick={() => { setResult(null); setErrors([]) }}
            className="mt-2 rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-raised transition-colors"
          >
            Import another file
          </button>
        </div>
      )}
    </div>
  )
}
