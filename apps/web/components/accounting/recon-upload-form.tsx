'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react'

export function ReconUploadForm() {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [dragging,   setDragging]   = useState(false)
  const [file,       setFile]       = useState<File | null>(null)
  const [uploading,  setUploading]  = useState(false)
  const [error,      setError]      = useState('')

  function onFiles(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    if (!f.name.endsWith('.csv') && f.type !== 'text/csv') {
      setError('Please upload a CSV file.')
      return
    }
    setFile(f)
    setError('')
  }

  async function handleUpload() {
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)

      const res  = await fetch('/api/reconcile/upload', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Upload failed')

      router.push(`/accounting/reconcile/${data.uploadId}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragging
            ? 'border-brand bg-brand/5'
            : file
            ? 'border-success/60 bg-success/5'
            : 'border-border hover:border-border-strong hover:bg-surface-raised'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => onFiles(e.target.files)}
        />
        {file ? (
          <div className="flex flex-col items-center gap-2">
            <FileText className="h-8 w-8 text-success" />
            <p className="text-sm font-medium text-text-primary">{file.name}</p>
            <p className="text-xs text-text-secondary">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-text-tertiary" />
            <p className="text-sm font-medium text-text-primary">Drop your bank statement CSV here</p>
            <p className="text-xs text-text-secondary">or click to browse · GCB, Absa, Ecobank, MTN MoMo supported</p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
      >
        {uploading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Uploading &amp; matching…</>
        ) : (
          <><Upload className="h-4 w-4" /> Upload &amp; Auto-match</>
        )}
      </button>

      {/* Supported format hint */}
      <div className="rounded-lg bg-surface-raised border border-border px-4 py-3 text-xs text-text-secondary space-y-1">
        <p className="font-medium text-text-primary">Accepted CSV columns (auto-detected)</p>
        <p>Date: <span className="font-mono">date · txn_date · transaction_date · value_date</span></p>
        <p>Description: <span className="font-mono">description · narration · details · particulars</span></p>
        <p>Debit: <span className="font-mono">debit · dr · withdrawal · debit_amount</span></p>
        <p>Credit: <span className="font-mono">credit · cr · deposit · credit_amount · amount</span></p>
        <p>Reference: <span className="font-mono">reference · ref · transaction_id · receipt_no</span></p>
      </div>
    </div>
  )
}
