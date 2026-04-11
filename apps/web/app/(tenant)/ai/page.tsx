import type { Metadata } from 'next'
import { Bot, Zap, MessageSquare, Phone } from 'lucide-react'
import { ChatWidget } from '@/components/ai/chat-widget'

export const metadata: Metadata = { title: 'AI Assistant' }

export default function AIPage() {
  const configured = !!process.env.ANTHROPIC_API_KEY

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">AI Booking Assistant</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Claude-powered agent that handles guest inquiries, checks availability, and escalates complex issues to staff.
        </p>
      </div>

      {!configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <p className="font-medium text-amber-800 dark:text-amber-300">API key not configured</p>
          <p className="mt-1 text-amber-700 dark:text-amber-400">
            Add <code className="font-mono text-xs bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">ANTHROPIC_API_KEY</code> to your <code className="font-mono text-xs bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">.env.local</code> to activate the AI agent.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Chat demo */}
        <div>
          <p className="mb-3 text-sm font-medium text-text-primary">Live preview</p>
          {configured ? (
            <ChatWidget />
          ) : (
            <div className="flex h-[600px] items-center justify-center rounded-xl border border-border bg-surface">
              <div className="text-center">
                <Bot className="mx-auto h-12 w-12 text-text-disabled" />
                <p className="mt-3 text-sm text-text-secondary">Configure API key to start chatting</p>
              </div>
            </div>
          )}
        </div>

        {/* Capabilities */}
        <div className="space-y-4">
          <p className="text-sm font-medium text-text-primary">Capabilities</p>

          <CapabilityCard
            icon={MessageSquare}
            title="Natural language Q&A"
            desc="Guests ask in English or any language — the agent responds naturally about availability, pricing, check-in procedures, and hostel policies."
          />
          <CapabilityCard
            icon={Zap}
            title="Live data tools"
            desc="The agent calls real-time tools: check_availability, get_pricing, search_faqs, and escalate_to_human — grounded in your actual room data."
          />
          <CapabilityCard
            icon={Bot}
            title="Tool-use agentic loop"
            desc="Multi-step reasoning: the agent looks up data, reasons over it, and responds — all in one seamless streaming reply."
          />
          <CapabilityCard
            icon={Phone}
            title="Human escalation"
            desc="When a guest's issue is complex, the agent logs an escalation to your audit trail and informs the guest that staff will follow up."
          />

          <div className="rounded-xl border border-border bg-surface p-4 text-xs text-text-secondary space-y-1">
            <p className="font-medium text-text-primary">Model: Claude Haiku 4.5</p>
            <p>Fastest, most cost-efficient Claude model — ideal for high-volume guest interactions.</p>
            <p className="mt-2 font-medium text-text-primary">Embed on your website</p>
            <p>Go to <strong>Settings → Widget</strong> to get the embed snippet that includes the AI chat button.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function CapabilityCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType
  title: string
  desc: string
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10">
        <Icon className="h-4 w-4 text-brand" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="mt-0.5 text-xs text-text-secondary leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}
