'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, ShieldAlert, Check, X } from 'lucide-react'

interface PendingAction {
  id:    string
  name:  string
  input: Record<string, unknown>
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  pending?: PendingAction
  resolved?: 'approved' | 'declined'
}

const ACTION_LABEL: Record<string, string> = {
  create_booking: 'Create booking',
  cancel_booking: 'Cancel booking',
  add_charge:     'Add charge',
  check_in:       'Check in guest',
  check_out:      'Check out guest',
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: "Hi! I can look up bookings, check availability, and — with your confirmation — create or cancel bookings, check guests in/out, and add folio charges. What do you need?",
}

/**
 * Staff-facing counterpart to components/ai/chat-widget.tsx, talking to
 * /api/ai/staff-assistant instead of the unauthenticated guest route.
 * Every write action arrives as a `confirm` SSE event instead of already
 * having run — this renders it as an ActionCard the staff member must
 * explicitly approve or decline before anything actually changes.
 */
export function StaffAssistantWidget() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function historyForApi(msgs: Message[]) {
    return msgs
      .filter((m) => m !== INITIAL_MESSAGE && !m.pending)
      .map((m) => ({ role: m.role, content: m.content }))
  }

  async function streamResponse(body: Record<string, unknown>) {
    setLoading(true)
    setMessages((prev) => [...prev, { role: 'assistant', content: '', streaming: true }])

    try {
      const res = await fetch('/api/ai/staff-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok || !res.body) throw new Error(await res.text())

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''
      let pending: PendingAction | undefined

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          let evt: any
          try { evt = JSON.parse(data) } catch { continue }

          if (evt.error) throw new Error(evt.error)

          if (evt.text) {
            accumulated += evt.text
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last?.streaming) next[next.length - 1] = { ...last, content: accumulated }
              return next
            })
          }

          if (evt.confirm) {
            pending = evt.confirm
          }
        }
      }

      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.streaming) {
          next[next.length - 1] = pending
            ? { role: 'assistant', content: accumulated, pending }
            : { role: 'assistant', content: accumulated || '…' }
        }
        return next
      })
    } catch (err: any) {
      setMessages((prev) => {
        const next = prev.filter((m) => !m.streaming)
        next.push({ role: 'assistant', content: `Sorry, something went wrong. (${err.message})` })
        return next
      })
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    const userMsg: Message = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    await streamResponse({ messages: historyForApi(nextMessages) })
  }

  async function resolveAction(msgIndex: number, approved: boolean) {
    const msg = messages[msgIndex]
    if (!msg.pending) return

    setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, resolved: approved ? 'approved' : 'declined' } : m)))

    const replayAssistantTurn = {
      role: 'assistant' as const,
      content: [
        ...(msg.content ? [{ type: 'text', text: msg.content }] : []),
        { type: 'tool_use', id: msg.pending.id, name: msg.pending.name, input: msg.pending.input },
      ],
    }

    await streamResponse({
      messages: [...historyForApi(messages.slice(0, msgIndex)), replayAssistantTurn],
      resolvedToolUse: { ...msg.pending, approved },
    })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex h-[650px] flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-3 border-b border-border bg-surface-raised px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10">
          <Bot className="h-4 w-4 text-brand" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">Staff Assistant</p>
          <p className="text-xs text-text-tertiary">Actions need your confirmation before anything changes</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
              msg.role === 'user' ? 'bg-brand text-white' : 'bg-surface-raised border border-border'
            }`}>
              {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5 text-brand" />}
            </div>
            <div className="max-w-[80%] space-y-2">
              {msg.content && (
                <div className={`rounded-2xl px-3.5 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'rounded-tr-sm bg-brand text-white'
                    : 'rounded-tl-sm border border-border bg-surface-raised text-text-primary'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                    {msg.streaming && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current" />}
                  </p>
                </div>
              )}

              {msg.pending && (
                <div className="rounded-xl border border-warning/30 bg-warning-subtle p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-warning-fg">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {ACTION_LABEL[msg.pending.name] ?? msg.pending.name}
                  </div>
                  <dl className="mt-2 space-y-0.5 text-xs text-text-secondary">
                    {Object.entries(msg.pending.input).map(([k, v]) => (
                      <div key={k} className="flex gap-1.5">
                        <dt className="font-medium text-text-tertiary">{k.replace(/_/g, ' ')}:</dt>
                        <dd className="truncate">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                  {!msg.resolved ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => resolveAction(i, true)}
                        disabled={loading}
                        className="flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg transition-colors hover:bg-brand-hover disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" /> Confirm
                      </button>
                      <button
                        onClick={() => resolveAction(i, false)}
                        disabled={loading}
                        className="flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" /> Decline
                      </button>
                    </div>
                  ) : (
                    <p className={`mt-2 text-xs font-medium ${msg.resolved === 'approved' ? 'text-success' : 'text-text-tertiary'}`}>
                      {msg.resolved === 'approved' ? '✓ Confirmed' : 'Declined'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="e.g. Is anything available this weekend?"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand"
            style={{ minHeight: 44, maxHeight: 120 }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
