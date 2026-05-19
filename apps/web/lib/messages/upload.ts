/**
 * Client-side helpers for messaging attachments.
 *
 *   - compressImage   resize/encode to webp to keep payloads small
 *   - uploadAttachment one-shot sign + PUT to Supabase Storage
 *   - readUrlFor      fetch a signed read URL for an existing attachment path
 *
 * Returned attachment record (matches the JSON we store on messages.attachments):
 *   {
 *     path:     "conversations/<id>/<sender>/<uuid>.webp",
 *     mime:     "image/webp",
 *     size:     32145,
 *     filename: "IMG_0123.webp",
 *     width?:   1600,
 *     height?:  1200,
 *     duration_s?: 8,
 *   }
 */

export interface AttachmentRecord {
  path:        string
  mime:        string
  size:        number
  filename:    string
  width?:      number
  height?:     number
  duration_s?: number
}

const IMAGE_MAX_DIM = 1600
const IMAGE_QUALITY = 0.82

export async function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const ratio = Math.min(1, IMAGE_MAX_DIM / Math.max(img.width, img.height))
    const w = Math.round(img.width * ratio)
    const h = Math.round(img.height * ratio)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/webp', IMAGE_QUALITY),
    )
    return { blob, width: w, height: h }
  } finally {
    URL.revokeObjectURL(url)
  }
}

interface SignResponse {
  upload_url: string
  token:      string
  path:       string
  mime:       string
  size:       number
  filename:   string
}

export async function uploadAttachment(opts: {
  conversationId: string
  blob:           Blob
  filename:       string
  mime:           string
  meta?:          Partial<Pick<AttachmentRecord, 'width' | 'height' | 'duration_s'>>
}): Promise<AttachmentRecord> {
  const signRes = await fetch('/api/messages/attachments/sign', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      conversation_id: opts.conversationId,
      filename:        opts.filename,
      mime:            opts.mime,
      size:            opts.blob.size,
    }),
  })
  if (!signRes.ok) {
    const data = await signRes.json().catch(() => ({}))
    throw new Error(typeof data.error === 'string' ? data.error : 'sign failed')
  }
  const sign = (await signRes.json()) as SignResponse

  const up = await fetch(sign.upload_url, {
    method:  'PUT',
    headers: { 'Content-Type': opts.mime, 'x-upsert': 'false' },
    body:    opts.blob,
  })
  if (!up.ok) throw new Error('upload failed')

  return {
    path:       sign.path,
    mime:       opts.mime,
    size:       opts.blob.size,
    filename:   opts.filename,
    width:      opts.meta?.width,
    height:     opts.meta?.height,
    duration_s: opts.meta?.duration_s,
  }
}

export async function readUrlFor(path: string): Promise<string | null> {
  const res = await fetch(`/api/messages/attachments/url?path=${encodeURIComponent(path)}`)
  if (!res.ok) return null
  const data = await res.json()
  return data.url ?? null
}

/* ── Voice recorder ───────────────────────────────────────────────────── */

export class VoiceRecorder {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private startedAt: number = 0

  async start(): Promise<void> {
    this.chunks = []
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mime =
      MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')             ? 'audio/webm'
                                                              : 'audio/mp4'
    this.recorder = new MediaRecorder(this.stream, { mimeType: mime })
    this.recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data) }
    this.recorder.start()
    this.startedAt = Date.now()
  }

  isRecording(): boolean {
    return !!this.recorder && this.recorder.state === 'recording'
  }

  /** Stop and return the encoded blob + duration in seconds. */
  async stop(): Promise<{ blob: Blob; mime: string; duration: number } | null> {
    if (!this.recorder) return null
    const mime = this.recorder.mimeType || 'audio/webm'
    const stopped = new Promise<void>((resolve) => {
      this.recorder!.onstop = () => resolve()
    })
    this.recorder.stop()
    await stopped

    const blob = new Blob(this.chunks, { type: mime })
    const duration = Math.max(1, Math.round((Date.now() - this.startedAt) / 1000))

    this.stream?.getTracks().forEach(t => t.stop())
    this.stream = null
    this.recorder = null
    this.chunks = []

    return { blob, mime, duration }
  }

  async cancel(): Promise<void> {
    try { this.recorder?.stop() } catch { /* ignore */ }
    this.stream?.getTracks().forEach(t => t.stop())
    this.stream = null
    this.recorder = null
    this.chunks = []
  }
}
