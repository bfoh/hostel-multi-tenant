import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Bot } from 'lucide-react'
import { StaffAssistantWidget } from '@/components/ai/staff-assistant-widget'

export const metadata: Metadata = { title: 'Staff Assistant' }

export default function StaffAssistantPage() {
  const configured = !!process.env.ANTHROPIC_API_KEY

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/ai"
          className="mb-2 inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-3 w-3" /> AI Assistant
        </Link>
        <h1 className="text-xl font-semibold text-text-primary">Staff Assistant</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Look up bookings, check availability, and — with your confirmation — create/cancel bookings,
          check guests in/out, and add folio charges, all by chat. Available to owners, managers, and receptionists.
        </p>
      </div>

      {configured ? (
        <StaffAssistantWidget />
      ) : (
        <div className="flex h-[400px] items-center justify-center rounded-xl border border-border bg-surface">
          <div className="text-center">
            <Bot className="mx-auto h-12 w-12 text-text-disabled" />
            <p className="mt-3 text-sm text-text-secondary">Configure ANTHROPIC_API_KEY to enable the staff assistant.</p>
          </div>
        </div>
      )}
    </div>
  )
}
