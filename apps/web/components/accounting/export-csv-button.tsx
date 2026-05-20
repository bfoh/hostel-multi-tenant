'use client'

import { Download } from 'lucide-react'

interface Props {
  filename: string
  /** Column headers in order */
  headers: string[]
  /** Rows aligned to headers; values stringified as-is (escape any commas/quotes) */
  rows: (string | number)[][]
  label?: string
}

function escapeCell(v: string | number): string {
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function ExportCsvButton({ filename, headers, rows, label = 'Export CSV' }: Props) {
  function handle() {
    const lines = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={handle}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
