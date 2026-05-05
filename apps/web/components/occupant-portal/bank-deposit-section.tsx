'use client'

import { useState } from 'react'
import { Building2, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { DraftUploadForm } from './draft-upload-form'
import { PendingDraftCard } from './pending-draft-card'

interface BankDetails {
  bank_name:           string | null
  bank_branch:         string | null
  bank_account_name:   string | null
  bank_account_number: string | null
  bank_swift_code:     string | null
  bank_instructions:   string | null
}

interface PendingDraft {
  id:                  string
  amount:              number   // pesewas
  draft_number:        string | null
  created_at:          string
}

interface Props {
  bookingId:    string
  balance:      number          // pesewas
  bankDetails:  BankDetails
  pending:      PendingDraft | null
  color:        string
}

export function BankDepositSection({ bookingId, balance, bankDetails, pending, color }: Props) {
  const [open, setOpen] = useState(false)

  if (balance <= 0 && !pending) return null
  if (!bankDetails.bank_name || !bankDetails.bank_account_name || !bankDetails.bank_account_number) return null

  const subLabel = pending ? '1 draft awaiting verification' : 'Upload your bank draft after depositing'

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
          <Building2 className="h-4 w-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">Pay by bank deposit</p>
          <p className="text-[11px] text-slate-500">{subLabel}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {pending ? (
            <PendingDraftCard pending={pending} />
          ) : (
            <>
              <BankDetailsBlock details={bankDetails} />
              <div className="border-t border-slate-100 px-5 py-2 text-center text-[11px] text-slate-400">
                — After you&apos;ve deposited, upload your draft —
              </div>
              <DraftUploadForm
                bookingId={bookingId}
                defaultAmount={balance}
                defaultBank={bankDetails.bank_name ?? ''}
                color={color}
              />
            </>
          )}
        </div>
      )}
    </section>
  )
}

function BankDetailsBlock({ details }: { details: BankDetails }) {
  return (
    <div className="bg-slate-50 px-5 py-4">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Deposit to this account</p>
      <Row label="Bank"        value={details.bank_name!} />
      {details.bank_branch && <Row label="Branch" value={details.bank_branch} />}
      <Row label="Account name" value={details.bank_account_name!} />
      <Row label="Account no." value={details.bank_account_number!} mono copyable />
      {details.bank_swift_code && <Row label="SWIFT" value={details.bank_swift_code} mono />}
      {details.bank_instructions && (
        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-[11px] leading-relaxed text-slate-600">
          {details.bank_instructions}
        </p>
      )}
    </div>
  )
}

function Row({ label, value, mono, copyable }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="flex items-center justify-between border-b border-dashed border-slate-200 py-2 last:border-b-0">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`flex items-center gap-2 text-[12px] font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>
        {value}
        {copyable && (
          <button type="button" onClick={copy} className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-700 hover:bg-slate-300">
            {copied ? <Check className="h-3 w-3" /> : 'Copy'}
          </button>
        )}
      </span>
    </div>
  )
}
