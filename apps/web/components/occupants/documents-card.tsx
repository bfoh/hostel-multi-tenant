'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Trash2, ExternalLink, Loader2, FolderOpen } from 'lucide-react'

interface Document {
  id: string
  document_type: string
  file_name: string
  file_url: string
  file_size: number | null
  notes: string | null
  created_at: string
}

const DOC_TYPE_LABELS: Record<string, string> = {
  ghana_card:         'Ghana Card',
  passport:           'Passport',
  voters_id:          'Voter\'s ID',
  nhis:               'NHIS Card',
  tenancy_agreement:  'Tenancy Agreement',
  offer_letter:       'Offer Letter',
  photo:              'Photo',
  other:              'Other',
}

const DOC_TYPE_ICON: Record<string, string> = {
  ghana_card: '🪪',
  passport:   '📘',
  photo:      '📷',
  tenancy_agreement: '📄',
  offer_letter: '✉️',
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentsCard({
  occupantId,
  initialDocs,
}: {
  occupantId: string
  initialDocs: Document[]
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [docs, setDocs]         = useState(initialDocs)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [docType, setDocType]   = useState('ghana_card')
  const [notes, setNotes]       = useState('')
  const [error, setError]       = useState<string | null>(null)

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const MAX = 10 * 1024 * 1024 // 10 MB
    if (file.size > MAX) { setError('File must be under 10 MB'); return }

    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('document_type', docType)
      if (notes) fd.append('notes', notes)

      const res = await fetch(`/api/occupants/${occupantId}/documents`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setDocs((prev) => [data, ...prev])
      setNotes('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this document?')) return
    setDeletingId(id)
    await fetch(`/api/occupants/documents/${id}`, { method: 'DELETE' })
    setDocs((prev) => prev.filter((d) => d.id !== id))
    setDeletingId(null)
  }

  return (
    <div className="space-y-4">
      {/* Upload section */}
      <div className="rounded-lg border border-dashed border-border bg-surface-raised p-4 space-y-3">
        <div className="flex items-center gap-3">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-surface py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors">
          {uploading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
          ) : (
            <><Upload className="h-4 w-4" /> Choose file to upload</>
          )}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
            onChange={upload}
            disabled={uploading}
          />
        </label>
        <p className="text-[11px] text-text-tertiary text-center">PDF, JPG, PNG up to 10 MB</p>

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      {/* Documents list */}
      {docs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <FolderOpen className="h-8 w-8 text-text-disabled" />
          <p className="text-sm text-text-tertiary">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-lg">
                {DOC_TYPE_ICON[doc.document_type] ?? '📎'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{doc.file_name}</p>
                <div className="flex items-center gap-2 text-xs text-text-tertiary mt-0.5">
                  <span>{DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}</span>
                  {doc.file_size && <span>{formatBytes(doc.file_size)}</span>}
                  <span>{new Date(doc.created_at).toLocaleDateString('en-GH', { dateStyle: 'medium' })}</span>
                  {doc.notes && <span className="truncate max-w-[120px]">{doc.notes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-text-tertiary hover:text-brand transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  onClick={() => remove(doc.id)}
                  disabled={deletingId === doc.id}
                  className="p-1.5 text-text-tertiary hover:text-danger transition-colors"
                >
                  {deletingId === doc.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
