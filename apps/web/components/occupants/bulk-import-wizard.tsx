'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import * as XLSX from 'xlsx'

import {
  occupantSchema,
  coerceOccupantRow,
  OCCUPANT_BULK_HEADERS,
  OCCUPANT_REQUIRED_HEADERS,
} from '@/lib/validation/occupant'

const MAX_ROWS = 1000

type ParsedRow = {
  index: number          // 1-based, position in source file (data rows only)
  raw: Record<string, unknown>
  data: Record<string, unknown>
  errors: string[]
  selected: boolean
}

type ImportResult = {
  created: number
  errors: { row: number; message: string }[]
}

type Step = 'upload' | 'preview' | 'done'

function readFileAsRows(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        if (!sheet) {
          resolve([])
          return
        }
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
          raw: false,
        })
        resolve(rows)
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Failed to parse file'))
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

function validateHeaders(rawRows: Record<string, unknown>[]): string | null {
  if (rawRows.length === 0) return 'File is empty.'
  const headers = Object.keys(rawRows[0]).map((h) => h.toLowerCase().trim())
  const missing = OCCUPANT_REQUIRED_HEADERS.filter((h) => !headers.includes(h))
  if (missing.length) {
    return `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Download the template for the correct format.`
  }
  return null
}

function processRows(raw: Record<string, unknown>[]): ParsedRow[] {
  return raw.map((r, i) => {
    const coerced = coerceOccupantRow(r)
    const parsed = occupantSchema.safeParse(coerced)
    const errors: string[] = []
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.')
        errors.push(path ? `${path}: ${issue.message}` : issue.message)
      }
    }
    return {
      index: i + 1,
      raw: r,
      data: coerced,
      errors,
      selected: errors.length === 0,
    }
  })
}

export function BulkImportWizard() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState<string>('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const stats = useMemo(() => {
    const valid = rows.filter((r) => r.errors.length === 0).length
    const invalid = rows.length - valid
    const selected = rows.filter((r) => r.selected).length
    return { total: rows.length, valid, invalid, selected }
  }, [rows])

  async function handleFile(file: File) {
    setParsing(true)
    setParseError(null)
    setFileName(file.name)
    try {
      const raw = await readFileAsRows(file)
      const headerErr = validateHeaders(raw)
      if (headerErr) {
        setParseError(headerErr)
        setParsing(false)
        return
      }
      if (raw.length > MAX_ROWS) {
        setParseError(`File contains ${raw.length} rows. Max is ${MAX_ROWS} per import. Split into smaller files.`)
        setParsing(false)
        return
      }
      const processed = processRows(raw)
      setRows(processed)
      setStep('preview')
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Failed to parse file')
    } finally {
      setParsing(false)
    }
  }

  function downloadTemplate() {
    const headers = [...OCCUPANT_BULK_HEADERS]
    const example: Record<string, string> = {
      first_name: 'Ama',
      last_name: 'Asante',
      other_names: '',
      phone: '0551109602',
      alternate_phone: '',
      email: 'ama@example.com',
      gender: 'female',
      date_of_birth: '2002-05-14',
      type: 'student',
      national_id_type: 'ghana_card',
      national_id_number: 'GHA-000000000-0',
      institution: 'UPSA',
      student_id: '10350163',
      programme: 'BSc Accounting',
      year_of_study: '2',
      semester: 'first',
      home_address: 'Accra',
      region_of_origin: 'Greater Accra',
      notes: '',
    }

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet([example], { header: headers })
    XLSX.utils.book_append_sheet(wb, ws, 'Occupants')

    const enums = [
      { field: 'type', allowed: 'student | professional | guest | staff' },
      { field: 'gender', allowed: 'male | female | prefer_not_to_say' },
      { field: 'national_id_type', allowed: 'ghana_card | passport | voters_id | nhis' },
      { field: 'semester', allowed: 'first | second | summer' },
      { field: 'year_of_study', allowed: '1-10 (integer)' },
      { field: 'date_of_birth', allowed: 'YYYY-MM-DD' },
    ]
    const wsEnum = XLSX.utils.json_to_sheet(enums)
    XLSX.utils.book_append_sheet(wb, wsEnum, 'Reference')

    XLSX.writeFile(wb, 'occupants-template.xlsx')
  }

  function downloadErrorReport() {
    if (!result) return
    const data = result.errors.map((e) => ({
      row: e.row,
      error: e.message,
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data, { header: ['row', 'error'] })
    XLSX.utils.book_append_sheet(wb, ws, 'Errors')
    XLSX.writeFile(wb, 'occupants-import-errors.xlsx')
  }

  function toggleRow(idx: number) {
    setRows((prev) =>
      prev.map((r) => (r.index === idx ? { ...r, selected: !r.selected } : r)),
    )
  }

  function selectAllValid() {
    setRows((prev) => prev.map((r) => ({ ...r, selected: r.errors.length === 0 })))
  }

  function deselectAll() {
    setRows((prev) => prev.map((r) => ({ ...r, selected: false })))
  }

  async function submitImport() {
    const payload = rows.filter((r) => r.selected && r.errors.length === 0).map((r) => r.data)
    if (payload.length === 0) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/occupants/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rows: payload }),
      })
      const json = await res.json()
      if (!res.ok) {
        setParseError(json.error ?? 'Import failed')
        setSubmitting(false)
        return
      }
      setResult({ created: json.created ?? 0, errors: json.errors ?? [] })
      setStep('done')
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setStep('upload')
    setFileName('')
    setParseError(null)
    setRows([])
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Step: upload ────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border bg-surface-sunken py-12 px-4 text-center">
            <FileSpreadsheet className="h-10 w-10 text-text-disabled" />
            <div>
              <p className="font-medium text-text-primary">Upload Excel or CSV file</p>
              <p className="mt-1 text-sm text-text-secondary">
                Accepted formats: .xlsx, .xls, .csv (max {MAX_ROWS} rows)
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={parsing}
              className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50"
            >
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {parsing ? 'Parsing…' : 'Choose file'}
            </button>
            {fileName && (
              <p className="text-xs text-text-tertiary">{fileName}</p>
            )}
          </div>

          {parseError && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-subtle p-3 text-sm text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{parseError}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Need a template?</p>
            <p className="text-xs text-text-secondary">
              Download an Excel template with the required columns and example row.
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors"
          >
            <Download className="h-4 w-4" />
            Download template
          </button>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 text-xs text-text-secondary">
          <p className="mb-2 font-medium text-text-primary">Required columns</p>
          <p className="font-mono">first_name, last_name, phone, type</p>
          <p className="mt-3 mb-2 font-medium text-text-primary">Allowed values</p>
          <ul className="space-y-0.5 font-mono">
            <li>type: student | professional | guest | staff</li>
            <li>gender: male | female | prefer_not_to_say</li>
            <li>national_id_type: ghana_card | passport | voters_id | nhis</li>
            <li>semester: first | second | summer</li>
          </ul>
        </div>

        <div>
          <Link
            href="/occupants"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to occupants
          </Link>
        </div>
      </div>
    )
  }

  // ── Step: done ──────────────────────────────────────────────────
  if (step === 'done' && result) {
    const hasErrors = result.errors.length > 0
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <h2 className="mt-3 text-xl font-bold text-text-primary">
            {result.created} occupant{result.created !== 1 ? 's' : ''} imported
          </h2>
          {hasErrors && (
            <p className="mt-1 text-sm text-text-secondary">
              {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} failed. Download the error report to fix and re-import.
            </p>
          )}
        </div>

        {hasErrors && (
          <div className="rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-medium text-text-primary">Errors ({result.errors.length})</p>
              <button
                onClick={downloadErrorReport}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-raised transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download report
              </button>
            </div>
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-sunken">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-text-tertiary">Row</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-text-tertiary">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.errors.map((e, i) => (
                    <tr key={`${e.row}-${i}`}>
                      <td className="px-4 py-2 ref-number text-xs text-text-secondary">{e.row}</td>
                      <td className="px-4 py-2 text-text-secondary">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/occupants')}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm"
          >
            View occupants
          </button>
          <button
            onClick={reset}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors"
          >
            Import another file
          </button>
        </div>
      </div>
    )
  }

  // ── Step: preview ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-4 text-sm">
          <div>
            <p className="text-text-tertiary text-xs">File</p>
            <p className="font-medium text-text-primary">{fileName}</p>
          </div>
          <div>
            <p className="text-text-tertiary text-xs">Total rows</p>
            <p className="font-medium text-text-primary">{stats.total}</p>
          </div>
          <div>
            <p className="text-text-tertiary text-xs">Valid</p>
            <p className="font-medium text-success">{stats.valid}</p>
          </div>
          <div>
            <p className="text-text-tertiary text-xs">Errors</p>
            <p className="font-medium text-danger">{stats.invalid}</p>
          </div>
          <div>
            <p className="text-text-tertiary text-xs">Selected</p>
            <p className="font-medium text-text-primary">{stats.selected}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={selectAllValid}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-raised transition-colors"
          >
            Select all valid
          </button>
          <button
            onClick={deselectAll}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-raised transition-colors"
          >
            Deselect all
          </button>
          <button
            onClick={reset}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {parseError && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-subtle p-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{parseError}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-sunken">
              <tr>
                <th className="w-10 px-3 py-2 text-left text-xs font-medium text-text-tertiary">#</th>
                <th className="w-10 px-3 py-2 text-left text-xs font-medium text-text-tertiary"></th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary">Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary">Phone</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary">Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary">Institution</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary">Student ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const ok = r.errors.length === 0
                return (
                  <tr key={r.index} className={ok ? '' : 'bg-danger-subtle/40'}>
                    <td className="px-3 py-2 ref-number text-xs text-text-tertiary">{r.index}</td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={r.selected}
                        disabled={!ok}
                        onChange={() => toggleRow(r.index)}
                        className="h-4 w-4 rounded border-border accent-brand"
                      />
                    </td>
                    <td className="px-3 py-2 text-text-primary">
                      {String(r.data.first_name ?? '')} {String(r.data.last_name ?? '')}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{String(r.data.phone ?? '')}</td>
                    <td className="px-3 py-2 text-text-secondary capitalize">{String(r.data.type ?? '')}</td>
                    <td className="px-3 py-2 text-text-secondary">{String(r.data.institution ?? '') || '—'}</td>
                    <td className="px-3 py-2 ref-number text-text-secondary text-xs">{String(r.data.student_id ?? '') || '—'}</td>
                    <td className="px-3 py-2">
                      {ok ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Valid
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium text-danger"
                          title={r.errors.join('\n')}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {r.errors[0]}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={reset}
          disabled={submitting}
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={submitImport}
          disabled={submitting || stats.selected === 0}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {submitting ? 'Importing…' : `Import ${stats.selected} occupant${stats.selected !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
