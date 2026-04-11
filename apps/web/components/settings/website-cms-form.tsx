'use client'

import { useState } from 'react'
import { Plus, Trash2, Loader2, Check, GripVertical, Image as ImageIcon, HelpCircle } from 'lucide-react'

interface Faq { q: string; a: string }

interface CmsContent {
  hero_heading?:    string | null
  hero_subheading?: string | null
  about_text?:      string | null
  amenities?:       string[]
  gallery_urls?:    string[]
  faqs?:            Faq[]
}

interface Props {
  initial: CmsContent
}

const COMMON_AMENITIES = [
  'WiFi', 'Air Conditioning', 'Running Water', 'Electricity / Generator',
  'Security', 'Parking', 'Canteen / Cafeteria', 'Study Room',
  'Laundry', 'CCTV', 'Common Room', 'Gym',
]

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-text-primary">{label}</label>
      {hint && <p className="text-xs text-text-secondary">{hint}</p>}
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-brand focus:outline-none'

export function WebsiteCmsForm({ initial }: Props) {
  const [heroHeading,    setHeroHeading]    = useState(initial.hero_heading    ?? '')
  const [heroSubheading, setHeroSubheading] = useState(initial.hero_subheading ?? '')
  const [aboutText,      setAboutText]      = useState(initial.about_text      ?? '')
  const [amenities,      setAmenities]      = useState<string[]>(initial.amenities   ?? [])
  const [galleryUrls,    setGalleryUrls]    = useState<string[]>(initial.gallery_urls ?? [''])
  const [faqs,           setFaqs]           = useState<Faq[]>(initial.faqs ?? [{ q: '', a: '' }])

  const [newAmenity, setNewAmenity] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState('')

  function toggleAmenity(name: string) {
    setAmenities((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name],
    )
  }

  function addAmenity() {
    const val = newAmenity.trim()
    if (!val || amenities.includes(val)) return
    setAmenities((prev) => [...prev, val])
    setNewAmenity('')
  }

  async function save(section: Partial<CmsContent>) {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const res = await fetch('/api/settings/website', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(section),
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

  function SaveBtn({ section }: { section: Partial<CmsContent> }) {
    return (
      <button
        onClick={() => save(section)}
        disabled={saving}
        className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}
        {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
      </button>
    )
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-text-primary">Hero Section</h3>
        <Field label="Heading" hint="Big headline shown at the top of your booking page">
          <input
            className={inputCls}
            value={heroHeading}
            onChange={(e) => setHeroHeading(e.target.value)}
            placeholder="Ghana's most comfortable student hostel"
            maxLength={120}
          />
        </Field>
        <Field label="Subheading" hint="One or two sentences beneath the headline">
          <textarea
            rows={2}
            className={inputCls}
            value={heroSubheading}
            onChange={(e) => setHeroSubheading(e.target.value)}
            placeholder="Modern rooms, fast WiFi, 24/7 security — book online in minutes."
            maxLength={300}
          />
        </Field>
        <div className="flex justify-end">
          <SaveBtn section={{ hero_heading: heroHeading, hero_subheading: heroSubheading }} />
        </div>
      </section>

      {/* ── About ────────────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-text-primary">About Section</h3>
        <Field label="About text" hint="Paragraph(s) describing your hostel — shown on the booking page">
          <textarea
            rows={5}
            className={inputCls}
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            placeholder="Tell prospective students about your hostel — location, facilities, history…"
            maxLength={2000}
          />
        </Field>
        <div className="flex justify-end">
          <SaveBtn section={{ about_text: aboutText }} />
        </div>
      </section>

      {/* ── Amenities ────────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-text-primary">Amenities</h3>
        <p className="text-xs text-text-secondary">Tick the amenities your hostel offers. These appear as badges on the booking page.</p>

        {/* Preset chips */}
        <div className="flex flex-wrap gap-2">
          {COMMON_AMENITIES.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => toggleAmenity(a)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                amenities.includes(a)
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-border bg-surface-raised text-text-secondary hover:border-brand/50'
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {/* Custom amenity */}
        <div className="flex gap-2">
          <input
            className={`${inputCls} flex-1`}
            value={newAmenity}
            onChange={(e) => setNewAmenity(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAmenity() } }}
            placeholder="Add custom amenity…"
            maxLength={60}
          />
          <button
            onClick={addAmenity}
            className="rounded-lg border border-border px-3 py-2 text-xs text-text-secondary hover:bg-surface-raised transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Custom amenities list */}
        {amenities.filter((a) => !COMMON_AMENITIES.includes(a)).map((a) => (
          <div key={a} className="flex items-center justify-between rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm">
            <span className="text-text-primary">{a}</span>
            <button onClick={() => setAmenities((prev) => prev.filter((x) => x !== a))}>
              <Trash2 className="h-3.5 w-3.5 text-text-tertiary hover:text-danger" />
            </button>
          </div>
        ))}

        <div className="flex justify-end">
          <SaveBtn section={{ amenities }} />
        </div>
      </section>

      {/* ── Gallery ──────────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-semibold text-text-primary">Gallery</h3>
        </div>
        <p className="text-xs text-text-secondary">Add up to 12 image URLs. Upload images to Supabase Storage or any CDN and paste the public URL.</p>

        <div className="space-y-2">
          {galleryUrls.map((url, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={`${inputCls} flex-1`}
                value={url}
                onChange={(e) => {
                  const next = [...galleryUrls]
                  next[i] = e.target.value
                  setGalleryUrls(next)
                }}
                placeholder="https://example.com/image.jpg"
              />
              <button
                onClick={() => setGalleryUrls((prev) => prev.filter((_, j) => j !== i))}
                className="rounded-lg border border-border px-2 text-text-tertiary hover:text-danger hover:bg-danger/5 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {galleryUrls.length < 12 && (
          <button
            onClick={() => setGalleryUrls((prev) => [...prev, ''])}
            className="flex items-center gap-1.5 text-xs text-brand hover:opacity-75"
          >
            <Plus className="h-3.5 w-3.5" /> Add image URL
          </button>
        )}

        <div className="flex justify-end">
          <SaveBtn section={{ gallery_urls: galleryUrls.filter(Boolean) }} />
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-semibold text-text-primary">FAQ</h3>
        </div>
        <p className="text-xs text-text-secondary">Common questions shown on your booking page. Up to 20 entries.</p>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface-raised p-4 space-y-2">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-text-tertiary shrink-0" />
                <span className="text-xs font-medium text-text-secondary">Q{i + 1}</span>
                <div className="flex-1" />
                <button
                  onClick={() => setFaqs((prev) => prev.filter((_, j) => j !== i))}
                  className="text-text-tertiary hover:text-danger transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                className={inputCls}
                value={faq.q}
                onChange={(e) => {
                  const next = [...faqs]
                  next[i] = { ...next[i], q: e.target.value }
                  setFaqs(next)
                }}
                placeholder="Question…"
                maxLength={300}
              />
              <textarea
                rows={2}
                className={inputCls}
                value={faq.a}
                onChange={(e) => {
                  const next = [...faqs]
                  next[i] = { ...next[i], a: e.target.value }
                  setFaqs(next)
                }}
                placeholder="Answer…"
                maxLength={1000}
              />
            </div>
          ))}
        </div>

        {faqs.length < 20 && (
          <button
            onClick={() => setFaqs((prev) => [...prev, { q: '', a: '' }])}
            className="flex items-center gap-1.5 text-xs text-brand hover:opacity-75"
          >
            <Plus className="h-3.5 w-3.5" /> Add question
          </button>
        )}

        <div className="flex justify-end">
          <SaveBtn section={{ faqs: faqs.filter((f) => f.q.trim() && f.a.trim()) }} />
        </div>
      </section>
    </div>
  )
}
