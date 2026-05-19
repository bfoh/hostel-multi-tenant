'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

export function ExportCsvButton({ from, to }: { from: string; to: string }) {
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    try {
      const url = `/api/reports/daily/export?from=${from}&to=${to}`
      // Use anchor click to honor content-disposition
      const a = document.createElement('a')
      a.href = url
      a.download = `daily-report_${from}_${to}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={download}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-sunken transition-colors disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      Export CSV
    </button>
  )
}
