'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, Loader2, CornerUpLeft, X, Paperclip, Mic, Square, Trash2, Smile, Pencil, MoreHorizontal } from 'lucide-react'
import type { PeerMap } from '@/lib/messages/peers'
import { compressImage, uploadAttachment, VoiceRecorder, type AttachmentRecord } from '@/lib/messages/upload'
import { AttachmentView } from '@/components/messages/attachment-view'

interface Reaction { id: string; emoji: string; user_id: string }
interface Message {
  id:              string
  conversation_id: string
  sender_id:       string | null
  kind:            string
  body:            string | null
  reply_to_id:     string | null
  attachments:     any[]
  edited_at:       string | null
  deleted_at:      string | null
  created_at:      string
  reactions?:      Reaction[]
}

interface Props {
  conversationId:   string
  conversationType: 'direct' | 'group' | 'broadcast'
  currentUserId:    string
  canPost:          boolean
  initialMessages:  Message[]
  peerNames:        PeerMap
}

export function ThreadView({
  conversationId,
  conversationType,
  currentUserId,
  canPost,
  initialMessages,
  peerNames,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [draft, setDraft]       = useState('')
  const [sending, setSending]   = useState(false)
  const [replyTo, setReplyTo]   = useState<Message | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [pendingAtt, setPendingAtt] = useState<AttachmentRecord[]>([])
  const [uploading, setUploading]   = useState(false)
  const [recording, setRecording]   = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const recorderRef = useRef<VoiceRecorder | null>(null)
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  // Mark read on mount + whenever new messages appear
  const markRead = useCallback(() => {
    fetch(`/api/messages/conversations/${conversationId}/read`, { method: 'POST' })
      .catch(() => {})
  }, [conversationId])
  useEffect(() => { markRead() }, [markRead, messages.length])

  const [typingPeers, setTypingPeers] = useState<string[]>([])

  // Realtime — messages + reactions + presence (typing) in one channel
  useEffect(() => {
    const sb = createClient()
    const ch = sb.channel(`conv:${conversationId}`, {
      config: { presence: { key: currentUserId } },
    })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages',
          filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Message
          setMessages((cur) => (cur.some(x => x.id === m.id) ? cur : [...cur, { ...m, reactions: [] }]))
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages',
          filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Message
          setMessages((cur) => cur.map(x => x.id === m.id ? { ...x, ...m } : x))
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const row: any = payload.new ?? payload.old
          const msgId = row?.message_id
          if (!msgId) return
          setMessages((cur) => cur.map((m) => {
            if (m.id !== msgId) return m
            const reactions = (m.reactions ?? []).slice()
            if (payload.eventType === 'INSERT') {
              if (!reactions.some(r => r.id === row.id)) reactions.push(row as Reaction)
            } else if (payload.eventType === 'DELETE') {
              const idx = reactions.findIndex(r => r.user_id === row.user_id && r.emoji === row.emoji)
              if (idx >= 0) reactions.splice(idx, 1)
            }
            return { ...m, reactions }
          }))
        })
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState() as Record<string, { user_id?: string; typing?: boolean }[]>
        const typers: string[] = []
        for (const [, list] of Object.entries(state)) {
          for (const v of list) {
            if (v.typing && v.user_id && v.user_id !== currentUserId) typers.push(v.user_id)
          }
        }
        setTypingPeers(Array.from(new Set(typers)))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ user_id: currentUserId, typing: false })
        }
      })

    return () => { sb.removeChannel(ch) }
  }, [conversationId, currentUserId])

  // Broadcast "typing" presence — debounced off after 3s of no keystrokes
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const sb = createClient()
    channelRef.current = sb.getChannels().find((c: any) => c.topic === `realtime:conv:${conversationId}`) ?? null
  }, [conversationId, messages.length])

  function pingTyping() {
    if (!canPost) return
    // Find the active channel from supabase singleton and track typing=true
    const sb = createClient()
    const ch = sb.getChannels().find((c: any) => c.topic.endsWith(`conv:${conversationId}`))
    if (!ch) return
    ch.track({ user_id: currentUserId, typing: true })
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      ch.track({ user_id: currentUserId, typing: false })
    }, 3000)
  }

  async function send() {
    const body = draft.trim()
    const hasAttachments = pendingAtt.length > 0
    if ((!body && !hasAttachments) || sending) return
    setSending(true); setError(null)
    try {
      // Pick a kind matching the dominant attachment when no text
      let kind: 'text' | 'image' | 'file' | 'audio' = 'text'
      if (!body && hasAttachments) {
        const first = pendingAtt[0].mime
        kind = first.startsWith('image/') ? 'image'
             : first.startsWith('audio/') ? 'audio'
                                          : 'file'
      }

      const res = await fetch(`/api/messages/conversations/${conversationId}/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          body:        body || null,
          kind,
          reply_to_id: replyTo?.id ?? null,
          attachments: pendingAtt,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Send failed')
        return
      }
      setMessages((cur) => (cur.some(x => x.id === data.id) ? cur : [...cur, data]))
      setDraft(''); setReplyTo(null); setPendingAtt([])
    } catch {
      setError('Network error')
    } finally {
      setSending(false)
    }
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (e.target) e.target.value = ''   // reset so picking same file again triggers change
    if (files.length === 0) return
    setUploading(true); setError(null)
    try {
      const out: AttachmentRecord[] = []
      for (const f of files) {
        if (f.type.startsWith('image/')) {
          const { blob, width, height } = await compressImage(f)
          const filename = f.name.replace(/\.[^.]+$/, '') + '.webp'
          const att = await uploadAttachment({
            conversationId, blob, filename, mime: 'image/webp',
            meta: { width, height },
          })
          out.push(att)
        } else {
          const att = await uploadAttachment({
            conversationId, blob: f, filename: f.name, mime: f.type || 'application/octet-stream',
          })
          out.push(att)
        }
      }
      setPendingAtt((cur) => [...cur, ...out])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function removePending(path: string) {
    setPendingAtt((cur) => cur.filter(a => a.path !== path))
  }

  async function startRecord() {
    if (recording) return
    const rec = new VoiceRecorder()
    try {
      await rec.start()
    } catch {
      setError('Mic permission denied')
      return
    }
    recorderRef.current = rec
    setRecording(true)
    setRecordSeconds(0)
    recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000)
  }

  async function stopRecord(send: boolean) {
    if (!recorderRef.current) return
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    setRecording(false)
    const result = await (send ? recorderRef.current.stop() : recorderRef.current.cancel().then(() => null))
    recorderRef.current = null

    if (!send || !result) return
    setUploading(true); setError(null)
    try {
      const ext = result.mime.includes('webm') ? 'webm' : 'm4a'
      const att = await uploadAttachment({
        conversationId,
        blob:     result.blob,
        filename: `voice-${Date.now()}.${ext}`,
        mime:     result.mime,
        meta:     { duration_s: result.duration },
      })
      setPendingAtt((cur) => [...cur, att])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice upload failed')
    } finally {
      setUploading(false)
    }
  }

  function senderName(uid: string | null): string {
    if (!uid) return 'Unknown'
    if (uid === currentUserId) return 'You'
    return peerNames[uid]?.display ?? 'Member'
  }

  // Group messages into date sections
  const groups = groupByDate(messages)

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-surface-sunken/50 px-3 py-4">
        {groups.length === 0 && (
          <p className="mt-12 text-center text-xs text-text-tertiary">
            No messages yet. Say hi 👋
          </p>
        )}
        {groups.map((g) => (
          <div key={g.label} className="space-y-1">
            <div className="my-3 flex items-center justify-center">
              <span className="rounded-full bg-surface px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border border-border">
                {g.label}
              </span>
            </div>
            {g.messages.map((m, idx) => {
              const prev = idx > 0 ? g.messages[idx - 1] : null
              const mine = m.sender_id === currentUserId
              const showSender =
                !mine
                && conversationType !== 'direct'
                && (!prev || prev.sender_id !== m.sender_id)
              return (
                <Bubble
                  key={m.id}
                  message={m}
                  mine={mine}
                  showSender={showSender}
                  senderLabel={senderName(m.sender_id)}
                  onReply={() => setReplyTo(m)}
                  allMessages={messages}
                  currentUserId={currentUserId}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Typing indicator */}
      {typingPeers.length > 0 && canPost && (
        <div className="border-t border-border bg-surface px-4 py-1 text-[11px] text-text-tertiary">
          {typingPeers.map(uid => peerNames[uid]?.display ?? 'Someone').slice(0, 2).join(', ')}
          {typingPeers.length > 2 ? ` +${typingPeers.length - 2} more` : ''} typing…
        </div>
      )}

      {/* Composer */}
      {canPost ? (
        <div className="border-t border-border bg-surface px-3 py-3 space-y-2">
          {replyTo && (
            <div className="flex items-start justify-between gap-2 rounded-md border-l-2 border-brand bg-surface-raised px-3 py-1.5 text-xs">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase text-text-tertiary">Reply to {senderName(replyTo.sender_id)}</p>
                <p className="truncate text-text-secondary">{replyTo.body ?? '·'}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-text-tertiary hover:text-text-primary">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Pending attachments preview */}
          {pendingAtt.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pendingAtt.map((a) => (
                <div key={a.path} className="flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-2 py-1 text-[11px]">
                  <span className="max-w-[140px] truncate">{a.filename}</span>
                  <button onClick={() => removePending(a.path)} className="text-text-tertiary hover:text-danger">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {uploading && <span className="text-[11px] text-text-tertiary"><Loader2 className="inline h-3 w-3 animate-spin" /> uploading…</span>}
            </div>
          )}

          {error && <p className="text-[11px] text-danger">{error}</p>}

          {recording ? (
            <div className="flex items-center gap-2 rounded-2xl border border-danger/40 bg-danger-subtle px-4 py-2.5 text-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
              <span className="font-mono text-danger">Recording · {fmtClock(recordSeconds)}</span>
              <div className="flex-1" />
              <button
                onClick={() => stopRecord(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface hover:bg-surface-raised"
                aria-label="Discard"
              >
                <Trash2 className="h-4 w-4 text-text-secondary" />
              </button>
              <button
                onClick={() => stopRecord(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-brand-fg hover:bg-brand-hover"
                aria-label="Stop and attach"
              >
                <Square className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,audio/*,video/*"
                onChange={onFilePicked}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface hover:bg-surface-raised transition-colors disabled:opacity-40"
                aria-label="Attach"
              >
                <Paperclip className="h-4 w-4 text-text-secondary" />
              </button>
              <textarea
                value={draft}
                onChange={(e) => { setDraft(e.target.value); pingTyping() }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
                }}
                rows={1}
                placeholder="Type a message…"
                className="flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                style={{ minHeight: 42, maxHeight: 160 }}
              />
              {draft.trim() || pendingAtt.length > 0 ? (
                <button
                  onClick={send}
                  disabled={sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-40"
                  aria-label="Send"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              ) : (
                <button
                  onClick={startRecord}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-fg hover:bg-brand-hover transition-colors"
                  aria-label="Voice note"
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="border-t border-border bg-surface px-4 py-3 text-center text-xs text-text-tertiary">
          Only staff can post in this announcement channel.
        </div>
      )}
    </>
  )
}

/* ── Message bubble ──────────────────────────────────────────────────────── */

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '🙏', '🔥']

function Bubble({
  message, mine, showSender, senderLabel, onReply, allMessages, currentUserId,
}: {
  message: Message
  mine: boolean
  showSender: boolean
  senderLabel: string
  onReply: () => void
  allMessages: Message[]
  currentUserId: string
}) {
  const isDeleted = !!message.deleted_at
  const replyTarget = message.reply_to_id ? allMessages.find(m => m.id === message.reply_to_id) : null
  const [showPicker, setShowPicker] = useState(false)
  const [editing, setEditing]       = useState(false)
  const [draft, setDraft]           = useState(message.body ?? '')
  const [busy, setBusy]             = useState(false)

  async function toggleReaction(emoji: string) {
    setShowPicker(false)
    const has = (message.reactions ?? []).some(r => r.user_id === currentUserId && r.emoji === emoji)
    try {
      if (has) {
        await fetch(`/api/messages/messages/${message.id}/react?emoji=${encodeURIComponent(emoji)}`, { method: 'DELETE' })
      } else {
        await fetch(`/api/messages/messages/${message.id}/react`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ emoji }),
        })
      }
    } catch { /* ignore */ }
  }

  async function saveEdit() {
    const next = draft.trim()
    if (!next || next === message.body) { setEditing(false); return }
    setBusy(true)
    try {
      await fetch(`/api/messages/messages/${message.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ body: next }),
      })
    } finally {
      setBusy(false); setEditing(false)
    }
  }

  async function softDelete() {
    if (!confirm('Delete this message?')) return
    setBusy(true)
    try {
      await fetch(`/api/messages/messages/${message.id}`, { method: 'DELETE' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`flex items-start gap-1.5 ${mine ? 'justify-end' : 'justify-start'} group`}>
      <div className="relative max-w-[78%]">
        {showSender && (
          <p className="ml-1 mb-0.5 text-[10px] font-semibold text-text-tertiary">{senderLabel}</p>
        )}
        <div
          className={`rounded-2xl px-3 py-2 text-sm ${
            mine
              ? 'rounded-tr-md bg-brand text-brand-fg'
              : 'rounded-tl-md bg-surface text-text-primary border border-border'
          }`}
        >
          {replyTarget && !isDeleted && (
            <div className={`mb-1 rounded-md border-l-2 px-2 py-1 text-[11px] ${
              mine ? 'border-white/60 bg-white/10' : 'border-brand bg-surface-raised'
            }`}>
              <p className={`truncate ${mine ? 'opacity-90' : 'text-text-secondary'}`}>
                {replyTarget.body ?? '·'}
              </p>
            </div>
          )}
          {isDeleted ? (
            <p className={`italic ${mine ? 'opacity-70' : 'text-text-tertiary'}`}>This message was deleted</p>
          ) : editing ? (
            <div className="space-y-1.5">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className={`w-full resize-y rounded-md border bg-surface px-2 py-1 text-sm ${mine ? 'text-text-primary border-border' : 'border-border'}`}
                autoFocus
              />
              <div className="flex justify-end gap-1.5">
                <button onClick={() => { setEditing(false); setDraft(message.body ?? '') }}
                  className="rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-text-primary">
                  Cancel
                </button>
                <button onClick={saveEdit} disabled={busy}
                  className="rounded-md bg-brand px-2 py-0.5 text-[11px] font-semibold text-brand-fg disabled:opacity-50">
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {Array.isArray(message.attachments) && message.attachments.length > 0 && (
                <div className="mb-1 space-y-1.5">
                  {(message.attachments as any[]).map((a, i) => (
                    <AttachmentView key={a.path ?? i} attachment={a} mine={mine} />
                  ))}
                </div>
              )}
              {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
            </>
          )}
          <p className={`mt-0.5 text-[9px] ${mine ? 'text-white/70 text-right' : 'text-text-tertiary'}`}>
            {formatTime(message.created_at)}{message.edited_at ? ' · edited' : ''}
          </p>
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${mine ? 'justify-end' : ''}`}>
            {aggregateReactions(message.reactions, currentUserId).map(({ emoji, count, mineActive }) => (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                className={`rounded-full border px-1.5 py-0.5 text-[11px] transition-colors ${
                  mineActive
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border bg-surface hover:bg-surface-raised text-text-primary'
                }`}
              >
                {emoji} {count}
              </button>
            ))}
          </div>
        )}

        {/* Emoji picker popover */}
        {showPicker && !isDeleted && (
          <div className={`absolute z-10 mt-1 flex gap-1 rounded-full border border-border bg-surface px-2 py-1 shadow ${mine ? 'right-0' : 'left-0'}`}>
            {QUICK_EMOJIS.map(e => (
              <button key={e} onClick={() => toggleReaction(e)} className="text-lg hover:scale-125 transition-transform">
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover actions */}
      {!isDeleted && (
        <div className={`flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 mt-1 transition-opacity ${mine ? 'order-first items-end' : ''}`}>
          <button
            onClick={() => setShowPicker((v) => !v)}
            title="React"
            className="rounded p-1 text-text-tertiary hover:bg-surface-raised"
          >
            <Smile className="h-3 w-3" />
          </button>
          <button
            onClick={onReply}
            title="Reply"
            className="rounded p-1 text-text-tertiary hover:bg-surface-raised"
          >
            <CornerUpLeft className="h-3 w-3" />
          </button>
          {mine && (
            <>
              <button onClick={() => setEditing(true)} title="Edit"
                className="rounded p-1 text-text-tertiary hover:bg-surface-raised">
                <Pencil className="h-3 w-3" />
              </button>
              <button onClick={softDelete} title="Delete" disabled={busy}
                className="rounded p-1 text-text-tertiary hover:bg-danger/10 hover:text-danger">
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
}

function fmtClock(s: number): string {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function aggregateReactions(rs: Reaction[], currentUserId?: string)
  : { emoji: string; count: number; mineActive: boolean }[] {
  const map = new Map<string, { count: number; mine: boolean }>()
  for (const r of rs) {
    const cur = map.get(r.emoji) ?? { count: 0, mine: false }
    cur.count += 1
    if (currentUserId && r.user_id === currentUserId) cur.mine = true
    map.set(r.emoji, cur)
  }
  return Array.from(map.entries()).map(([emoji, v]) => ({ emoji, count: v.count, mineActive: v.mine }))
}

function groupByDate(messages: Message[]): { label: string; messages: Message[] }[] {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)

  const groups: { label: string; messages: Message[] }[] = []
  for (const m of messages) {
    const d = new Date(m.created_at); d.setHours(0, 0, 0, 0)
    const label =
      d.getTime() === today.getTime()     ? 'Today'
    : d.getTime() === yesterday.getTime() ? 'Yesterday'
    : d.toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short' })

    const last = groups[groups.length - 1]
    if (last && last.label === label) last.messages.push(m)
    else groups.push({ label, messages: [m] })
  }
  return groups
}
