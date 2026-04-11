'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: "Hello! I'm your booking assistant. I can help you check room availability, pricing, and answer questions about our hostel. How can I help you today?",
}

export function ChatWidget() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Build conversation history (exclude INITIAL_MESSAGE system intro for API)
    const history = [...messages, userMsg]
      .filter((m) => !(m === INITIAL_MESSAGE))
      .map((m) => ({ role: m.role, content: m.content }))

    // Add streaming placeholder
    setMessages((prev) => [...prev, { role: 'assistant', content: '', streaming: true }])

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })

      if (!res.ok || !res.body) {
        throw new Error(await res.text())
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

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
          try {
            const evt = JSON.parse(data)
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
          } catch (e: any) {
            if (e.message && !e.message.includes('JSON')) throw e
          }
        }
      }

      // Finalise — remove streaming flag
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.streaming) next[next.length - 1] = { role: 'assistant', content: accumulated || '…' }
        return next
      })
    } catch (err: any) {
      setMessages((prev) => {
        const next = [...prev.filter((m) => !m.streaming)]
        next.push({ role: 'assistant', content: `Sorry, I encountered an error. Please try again. (${err.message})` })
        return next
      })
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-[600px] rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-surface-raised px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10">
          <Bot className="h-4 w-4 text-brand" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">AI Booking Assistant</p>
          <p className="text-xs text-text-tertiary">Powered by Claude · always available</p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Online
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
              msg.role === 'user' ? 'bg-brand text-white' : 'bg-surface-raised border border-border'
            }`}>
              {msg.role === 'user'
                ? <User className="h-3.5 w-3.5" />
                : <Bot className="h-3.5 w-3.5 text-brand" />
              }
            </div>
            <div
              className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-brand text-white rounded-tr-sm'
                  : 'bg-surface-raised border border-border text-text-primary rounded-tl-sm'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">
                {msg.content}
                {msg.streaming && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current" />}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about rooms, pricing, or policies…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand leading-relaxed"
            style={{ minHeight: 44, maxHeight: 120 }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />
            }
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-text-disabled">
          AI may make mistakes — verify important information with staff
        </p>
      </div>
    </div>
  )
}
