import { createAdminClient } from '@/lib/supabase/admin'

/* ── Types ────────────────────────────────────────────────────────────── */

export interface StatementRow {
  id:          string
  upload_id:   string
  txn_date:    string
  description: string
  debit:       number
  credit:      number
  balance:     number | null
  reference:   string | null
  status:      'unmatched' | 'matched' | 'excluded' | 'manual'
  matched_entry_id: string | null
  matched_line_id:  string | null
  notes:       string | null
  uploaded_at: string
}

export interface ReconciliationSummary {
  totalRows:        number
  matched:          number
  unmatched:        number
  excluded:         number
  totalCredit:      number   // money in (pesewas)
  totalDebit:       number   // money out (pesewas)
  unmatchedCredit:  number
}

/* ── CSV parser ───────────────────────────────────────────────────────── */

/**
 * Parse a generic bank/MoMo CSV.
 * Tries to detect columns by header name (case-insensitive).
 * Accepted header aliases:
 *   date:        date, txn_date, transaction_date, value_date
 *   description: description, narration, details, particulars
 *   debit:       debit, dr, withdrawal, debit_amount
 *   credit:      credit, cr, deposit, credit_amount
 *   balance:     balance, running_balance, closing_balance
 *   reference:   reference, ref, cheque_no, transaction_id, txn_id
 */
export function parseStatementCSV(csv: string): Omit<StatementRow, 'id' | 'upload_id' | 'status' | 'matched_entry_id' | 'matched_line_id' | 'uploaded_at'>[] {
  const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []

  // Parse header
  const headerLine = lines[0]
  const headers    = parseCSVRow(headerLine).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))

  const idx = (aliases: string[]) => {
    for (const alias of aliases) {
      const i = headers.findIndex((h) => h === alias || h.includes(alias))
      if (i !== -1) return i
    }
    return -1
  }

  const dateIdx = idx(['date', 'txn_date', 'transaction_date', 'value_date', 'posting_date'])
  const descIdx = idx(['description', 'narration', 'details', 'particulars', 'remarks'])
  const drIdx   = idx(['debit', 'dr', 'withdrawal', 'debit_amount', 'amount_dr'])
  const crIdx   = idx(['credit', 'cr', 'deposit', 'credit_amount', 'amount_cr', 'amount'])
  const balIdx  = idx(['balance', 'running_balance', 'closing_balance', 'available_balance'])
  const refIdx  = idx(['reference', 'ref', 'cheque_no', 'transaction_id', 'txn_id', 'receipt_no'])

  if (dateIdx === -1 || descIdx === -1) return []

  const rows: ReturnType<typeof parseStatementCSV> = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = parseCSVRow(line)
    const rawDate = cols[dateIdx]?.trim() ?? ''
    const rawDesc = cols[descIdx]?.trim() ?? ''
    if (!rawDate || !rawDesc) continue

    const txn_date = normaliseDate(rawDate)
    if (!txn_date) continue

    const debit   = drIdx   !== -1 ? parsePesewas(cols[drIdx]   ?? '') : 0
    const credit  = crIdx   !== -1 ? parsePesewas(cols[crIdx]   ?? '') : 0
    const balance = balIdx  !== -1 ? (parsePesewas(cols[balIdx] ?? '') || null) : null
    const ref     = refIdx  !== -1 ? (cols[refIdx]?.trim() || null) : null

    if (debit === 0 && credit === 0) continue  // skip zero-value rows

    rows.push({
      txn_date,
      description: rawDesc,
      debit,
      credit,
      balance,
      reference: ref,
      notes: null,
    })
  }

  return rows
}

function parseCSVRow(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parsePesewas(s: string): number {
  // Remove currency symbols, commas, spaces, then parse as float and × 100
  const cleaned = s.replace(/[^\d.-]/g, '')
  const n = parseFloat(cleaned)
  if (isNaN(n) || n < 0) return 0
  return Math.round(n * 100)
}

function normaliseDate(s: string): string | null {
  // Try multiple formats: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD MMM YYYY
  const clean = s.trim()

  // ISO 8601: already fine
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`

  // DD MMM YYYY  e.g. "15 Jan 2025"
  const dMonthY = clean.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (dMonthY) {
    const months: Record<string, string> = {
      jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
      jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
    }
    const m = months[dMonthY[2].toLowerCase()]
    if (m) return `${dMonthY[3]}-${m}-${dMonthY[1].padStart(2, '0')}`
  }

  return null
}

/* ── Upload statement rows ────────────────────────────────────────────── */

export async function uploadStatementRows(
  rows: Omit<StatementRow, 'id' | 'upload_id' | 'status' | 'matched_entry_id' | 'matched_line_id' | 'uploaded_at'>[],
  tenantId: string,
  uploadId: string,
): Promise<{ inserted: number; error?: string }> {
  const supabase = createAdminClient()

  const toInsert = rows.map((r) => ({
    ...r,
    tenant_id: tenantId,
    upload_id: uploadId,
  }))

  const { error, count } = await (supabase as any)
    .from('bank_statements')
    .insert(toInsert, { count: 'exact' })

  if (error) return { inserted: 0, error: error.message }
  return { inserted: count ?? rows.length }
}

/* ── Auto-match ───────────────────────────────────────────────────────── */

export async function autoMatchStatements(tenantId: string, uploadId: string): Promise<number> {
  const supabase = createAdminClient()

  // Fetch unmatched credit rows from this upload
  const { data: stmtRows } = await (supabase as any)
    .from('bank_statements')
    .select('id, txn_date, credit, reference, description')
    .eq('tenant_id', tenantId)
    .eq('upload_id', uploadId)
    .eq('status', 'unmatched')
    .gt('credit', 0)

  if (!stmtRows?.length) return 0

  // Fetch journal entries (Cash account credits) within date range
  const dates    = stmtRows.map((r: any) => r.txn_date).sort()
  const fromDate = dates[0]
  const toDate   = dates[dates.length - 1]

  const { data: journalLines } = await (supabase as any)
    .from('journal_lines')
    .select(`
      id, debit, credit,
      entry:journal_entries!inner(id, entry_date, reference, description, source_id)
    `)
    .eq('tenant_id', tenantId)
    .eq('debit', 0)       // credit lines only (money in)
    .gte('journal_entries.entry_date', fromDate)
    .lte('journal_entries.entry_date', toDate)
    .gt('credit', 0)

  let matched = 0

  for (const stmt of stmtRows as any[]) {
    // Try to find a journal line with:
    // 1. Same amount (±5 pesewas rounding tolerance)
    // 2. Date within ±2 days
    // 3. Optional: reference substring match
    const stmtDate = new Date(stmt.txn_date).getTime()

    const candidate = (journalLines as any[])?.find((line) => {
      const lineDate = new Date(line.entry.entry_date).getTime()
      const dateDiff = Math.abs(stmtDate - lineDate) / 86_400_000

      const amountMatch = Math.abs(line.credit - stmt.credit) <= 5
      const dateMatch   = dateDiff <= 2
      const refMatch    = !stmt.reference
        || !line.entry.reference
        || line.entry.reference.includes(stmt.reference)
        || stmt.reference.includes(line.entry.reference)

      return amountMatch && dateMatch && refMatch
    })

    if (candidate) {
      await (supabase as any)
        .from('bank_statements')
        .update({
          status: 'matched',
          matched_entry_id: candidate.entry.id,
          matched_line_id:  candidate.id,
        })
        .eq('id', stmt.id)
      matched++
    }
  }

  return matched
}

/* ── Fetch statement rows ─────────────────────────────────────────────── */

export async function getStatementRows(
  uploadId?: string,
  status?: string,
  limit = 200,
): Promise<StatementRow[]> {
  const supabase = createAdminClient()
  let q = (supabase as any)
    .from('bank_statements')
    .select('*')
    .order('txn_date', { ascending: false })
    .order('uploaded_at', { ascending: false })
    .limit(limit)

  if (uploadId) q = q.eq('upload_id', uploadId)
  if (status && status !== 'all') q = q.eq('status', status)

  const { data } = await q
  return (data ?? []) as StatementRow[]
}

export async function getReconSummary(): Promise<ReconciliationSummary> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('bank_statements')
    .select('status, credit, debit')

  const rows = data ?? []
  const totalRows        = rows.length
  const matched          = rows.filter((r: any) => r.status === 'matched').length
  const unmatched        = rows.filter((r: any) => r.status === 'unmatched').length
  const excluded         = rows.filter((r: any) => r.status === 'excluded').length
  const totalCredit      = rows.reduce((s: number, r: any) => s + r.credit, 0)
  const totalDebit       = rows.reduce((s: number, r: any) => s + r.debit,  0)
  const unmatchedCredit  = rows.filter((r: any) => r.status === 'unmatched').reduce((s: number, r: any) => s + r.credit, 0)

  return { totalRows, matched, unmatched, excluded, totalCredit, totalDebit, unmatchedCredit }
}

export async function updateStatementStatus(
  id: string,
  status: 'matched' | 'excluded' | 'manual' | 'unmatched',
  notes?: string,
) {
  const supabase = createAdminClient()
  await (supabase as any)
    .from('bank_statements')
    .update({ status, notes: notes ?? null })
    .eq('id', id)
}
