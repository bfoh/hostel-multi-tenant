'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex-1 rounded-xl border border-border bg-surface py-2.5 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors"
    >
      Print label
    </button>
  )
}
