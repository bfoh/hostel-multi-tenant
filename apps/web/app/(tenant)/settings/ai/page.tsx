import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { ChevronLeft, Bot } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AiConfigForm } from '@/components/settings/ai-config-form'

export const metadata: Metadata = { title: 'AI Agent Settings' }

export default async function AiSettingsPage() {
  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id')

  if (!tenantId) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('tenants')
    .select('name, ai_config')
    .eq('id', tenantId)
    .single()

  const aiConfig = ((data as any)?.ai_config ?? {}) as Record<string, unknown>
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Settings
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm font-medium text-text-primary">AI Agent</span>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
          <Bot className="h-5 w-5 text-brand" /> AI Chat Agent
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Configure your AI booking assistant — name, personality, language, and capabilities.
        </p>
      </div>

      {!hasApiKey && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <strong>ANTHROPIC_API_KEY is not set.</strong> The AI agent will not respond until the environment variable is configured in your deployment.
        </div>
      )}

      <AiConfigForm initial={aiConfig as any} hostelName={(data as any)?.name ?? 'your hostel'} />

      {/* Link to live preview */}
      <div className="rounded-xl border border-border bg-surface-raised px-5 py-4 text-sm">
        <p className="font-medium text-text-primary">Test your agent</p>
        <p className="text-xs text-text-secondary mt-0.5">
          Visit <Link href="/ai" className="text-brand hover:underline">AI Assistant</Link> to chat with your configured agent in real time.
        </p>
      </div>
    </div>
  )
}
