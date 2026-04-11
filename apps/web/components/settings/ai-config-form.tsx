'use client'

import { useState } from 'react'
import { Loader2, Check, Bot, Globe, Zap, MessageSquare, ToggleLeft, ToggleRight } from 'lucide-react'

interface AiConfig {
  ai_enabled:      boolean
  agent_name:      string
  personality:     'professional' | 'friendly' | 'casual'
  language:        'en' | 'tw'
  custom_greeting: string | null
  tools_enabled: {
    check_availability: boolean
    get_pricing:        boolean
    search_faqs:        boolean
    escalate_to_human:  boolean
  }
}

const DEFAULT_CONFIG: AiConfig = {
  ai_enabled:      true,
  agent_name:      'Ama',
  personality:     'professional',
  language:        'en',
  custom_greeting: null,
  tools_enabled: {
    check_availability: true,
    get_pricing:        true,
    search_faqs:        true,
    escalate_to_human:  true,
  },
}

const PERSONALITIES = [
  { value: 'professional', label: 'Professional', desc: 'Formal, precise, business-like' },
  { value: 'friendly',     label: 'Friendly',     desc: 'Warm and approachable, still polite' },
  { value: 'casual',       label: 'Casual',       desc: 'Relaxed and conversational' },
]

const LANGUAGES = [
  { value: 'en', label: 'English', flag: '🇬🇭' },
  { value: 'tw', label: 'Twi',     flag: '🇬🇭' },
]

const TOOLS: { key: keyof AiConfig['tools_enabled']; label: string; desc: string }[] = [
  { key: 'check_availability', label: 'Check availability', desc: 'Agent can look up which rooms are free' },
  { key: 'get_pricing',        label: 'Get pricing',        desc: 'Agent can quote room rates to guests' },
  { key: 'search_faqs',        label: 'Search FAQs',        desc: 'Agent reads your FAQ content to answer questions' },
  { key: 'escalate_to_human',  label: 'Escalate to staff',  desc: 'Agent can hand off complex issues to your team' },
]

const inputCls = 'w-full rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:border-brand focus:outline-none transition-colors'

export function AiConfigForm({ initial, hostelName }: { initial: Partial<AiConfig>; hostelName: string }) {
  const [config, setConfig] = useState<AiConfig>({ ...DEFAULT_CONFIG, ...initial, tools_enabled: { ...DEFAULT_CONFIG.tools_enabled, ...(initial.tools_enabled ?? {}) } })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState('')

  function set<K extends keyof AiConfig>(key: K, value: AiConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  function setTool(key: keyof AiConfig['tools_enabled'], value: boolean) {
    setConfig((prev) => ({ ...prev, tools_enabled: { ...prev.tools_enabled, [key]: value } }))
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const res = await fetch('/api/settings/ai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data.error))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const preview = config.custom_greeting?.trim()
    || `Hello! I'm ${config.agent_name}, the AI booking assistant for ${hostelName}. How can I help you today?`

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      {/* Enable / disable toggle */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-brand" />
          <div>
            <p className="text-sm font-medium text-text-primary">AI chat agent</p>
            <p className="text-xs text-text-secondary">Enable or disable the AI assistant for your booking page</p>
          </div>
        </div>
        <button
          onClick={() => set('ai_enabled', !config.ai_enabled)}
          className="shrink-0"
          aria-label="Toggle AI"
        >
          {config.ai_enabled
            ? <ToggleRight className="h-8 w-8 text-brand" />
            : <ToggleLeft  className="h-8 w-8 text-text-tertiary" />
          }
        </button>
      </div>

      {/* Agent identity */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Bot className="h-4 w-4 text-brand" /> Agent Identity
        </h3>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">Agent name</label>
          <input
            className={inputCls}
            value={config.agent_name}
            onChange={(e) => set('agent_name', e.target.value)}
            placeholder="Ama"
            maxLength={40}
          />
          <p className="text-xs text-text-secondary">The name guests will see when chatting</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">Custom greeting</label>
          <textarea
            rows={2}
            className={inputCls}
            value={config.custom_greeting ?? ''}
            onChange={(e) => set('custom_greeting', e.target.value || null)}
            placeholder={`Hello! I'm ${config.agent_name || 'Ama'}, your booking assistant at ${hostelName}…`}
            maxLength={300}
          />
          <p className="text-xs text-text-secondary">Leave blank to use the default greeting</p>
        </div>

        {/* Live preview */}
        <div className="rounded-xl border border-border bg-surface-raised p-4">
          <p className="text-xs font-medium text-text-secondary mb-2">Preview</p>
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-white text-xs font-bold">
              {(config.agent_name?.[0] ?? 'A').toUpperCase()}
            </div>
            <div className="rounded-xl rounded-tl-none bg-brand/10 px-3 py-2 text-sm text-text-primary max-w-xs">
              {preview}
            </div>
          </div>
        </div>
      </section>

      {/* Personality + Language */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-brand" /> Personality &amp; Language
        </h3>

        <div className="space-y-2">
          <p className="text-sm font-medium text-text-primary">Personality</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PERSONALITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => set('personality', p.value as AiConfig['personality'])}
                className={`rounded-xl border-2 px-4 py-3 text-left transition-all ${
                  config.personality === p.value
                    ? 'border-brand bg-brand/5'
                    : 'border-border hover:border-border-strong'
                }`}
              >
                <p className="text-sm font-medium text-text-primary">{p.label}</p>
                <p className="text-xs text-text-secondary mt-0.5">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-text-primary flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Language
          </p>
          <div className="flex gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => set('language', l.value as AiConfig['language'])}
                className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                  config.language === l.value
                    ? 'border-brand bg-brand/5 text-brand'
                    : 'border-border text-text-secondary hover:border-border-strong'
                }`}
              >
                <span>{l.flag}</span> {l.label}
              </button>
            ))}
          </div>
          {config.language === 'tw' && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Twi responses depend on the underlying model's Twi capability. Quality may vary.
            </p>
          )}
        </div>
      </section>

      {/* Tool capabilities */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Zap className="h-4 w-4 text-brand" /> Capabilities
        </h3>
        <p className="text-xs text-text-secondary">Choose which tools the agent is allowed to use.</p>
        {TOOLS.map((tool) => (
          <div key={tool.key} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
            <div>
              <p className="text-sm font-medium text-text-primary">{tool.label}</p>
              <p className="text-xs text-text-secondary">{tool.desc}</p>
            </div>
            <button
              onClick={() => setTool(tool.key, !config.tools_enabled[tool.key])}
              className="shrink-0 ml-4"
            >
              {config.tools_enabled[tool.key]
                ? <ToggleRight className="h-7 w-7 text-brand" />
                : <ToggleLeft  className="h-7 w-7 text-text-tertiary" />
              }
            </button>
          </div>
        ))}
      </section>

      {/* Save */}
      <button
        onClick={save}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving  ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> :
         saved   ? <><Check   className="h-4 w-4" /> Saved!</> :
         'Save AI settings'}
      </button>
    </div>
  )
}
