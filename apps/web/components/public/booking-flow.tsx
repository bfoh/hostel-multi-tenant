'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Check, Users, Wifi, Wind, Droplets, Zap, Shield, Car, Utensils, Dumbbell, BookOpen, Share2, Phone, Flame, Clock, ArrowUpRight, BedDouble, UsersRound } from 'lucide-react'

/* ── Types ─────────────────────────────────────────────────────────────── */

interface Category {
  id: string
  name: string
  type: string
  base_rate: number
  rate_unit: string
  capacity: number
  amenities: string[]
  description: string | null
  image_urls: string[]
  available: number
  total: number
}

interface Tenant {
  id: string
  name: string
  slug: string
  brandColor: string
  roommate_matching_enabled?: boolean
}

interface BookingFlowProps {
  categories: Category[]
  tenant: Tenant
}

interface OccupantMatchingProfile {
  cleanliness: number | null
  sleep_schedule: 'early_bird' | 'night_owl' | 'flexible' | null
  study_preference: 'in_room_quiet' | 'in_room_background_noise' | 'library' | null
  guest_frequency: 'none' | 'rare' | 'frequent' | null
  noise_tolerance: number | null
  ac_preference: 'ac_cold' | 'fan_only' | 'no_preference' | null
  hobbies: string[]
  religion: 'christian' | 'muslim' | 'traditional' | 'other' | 'none' | 'prefer_not_to_say' | null
  religiosity_level: 'devout' | 'moderate' | 'not_religious' | null
  relationship_status: 'single' | 'in_relationship' | 'married' | null
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function formatGHS(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}

const RATE_LABEL: Record<string, string> = {
  night:    '/ night',
  week:     '/ week',
  month:    '/ month',
  semester: '/ semester',
}

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  wifi:          <Wifi className="h-3.5 w-3.5" />,
  ac:            <Wind className="h-3.5 w-3.5" />,
  water:         <Droplets className="h-3.5 w-3.5" />,
  electricity:   <Zap className="h-3.5 w-3.5" />,
  security:      <Shield className="h-3.5 w-3.5" />,
  parking:       <Car className="h-3.5 w-3.5" />,
  canteen:       <Utensils className="h-3.5 w-3.5" />,
  gym:           <Dumbbell className="h-3.5 w-3.5" />,
  'study room':  <BookOpen className="h-3.5 w-3.5" />,
}

const TYPE_LABEL: Record<string, string> = {
  single:  'Single Room',
  double:  'Double Room',
  triple:  'Triple Room',
  suite:   'Suite',
  dormitory: 'Dormitory',
}

/* ── Scarcity indicator ────────────────────────────────────────────────── */

function scarcityLevel(available: number, total: number): 'none' | 'low' | 'critical' | 'sold' {
  if (available === 0) return 'sold'
  if (available <= 2) return 'critical'
  if (total > 0 && available / total <= 0.3) return 'low'
  return 'none'
}

function ScarcityBadge({
  available,
  total,
  variant = 'solid',
}: {
  available: number
  total: number
  variant?: 'solid' | 'glass'
}) {
  const level = scarcityLevel(available, total)
  const glass = variant === 'glass'

  if (level === 'sold') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
          glass
            ? 'bg-black/55 text-white backdrop-blur-md ring-1 ring-white/10'
            : 'bg-gray-900 text-white'
        }`}
      >
        <Clock className="h-3 w-3" /> Sold out
      </span>
    )
  }
  if (level === 'critical') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${
          glass
            ? 'bg-red-500/90 text-white backdrop-blur-md ring-1 ring-white/20 shadow-[0_4px_14px_rgba(239,68,68,0.4)]'
            : 'bg-red-500 text-white shadow-[0_4px_14px_rgba(239,68,68,0.35)]'
        }`}
      >
        <Flame className="h-3 w-3" /> Only {available} left
      </span>
    )
  }
  if (level === 'low') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
          glass
            ? 'bg-amber-400/90 text-amber-950 backdrop-blur-md ring-1 ring-white/20'
            : 'bg-amber-100 text-amber-800'
        }`}
      >
        <Flame className="h-3 w-3" /> {available} left
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
        glass
          ? 'bg-white/80 text-emerald-900 backdrop-blur-md ring-1 ring-emerald-900/10'
          : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/10'
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {available} available
    </span>
  )
}

/* ── Step 1 — Room Picker ──────────────────────────────────────────────── */

function RoomPicker({
  categories,
  brandColor,
  onSelect,
}: {
  categories: Category[]
  brandColor: string
  onSelect: (cat: Category) => void
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map(cat => {
        const sold = cat.available === 0
        const hasImage = cat.image_urls.length > 0
        const typeLabel = cat.type ? (TYPE_LABEL[cat.type] ?? cat.type) : null

        return (
          <article
            key={cat.id}
            className={`group relative flex flex-col overflow-hidden rounded-[20px] bg-white ring-1 ring-gray-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-all duration-300 will-change-transform ${
              sold
                ? 'opacity-60'
                : 'hover:-translate-y-1 hover:shadow-[0_4px_8px_rgba(15,23,42,0.06),0_24px_48px_-16px_rgba(15,23,42,0.2)] hover:ring-gray-300/70'
            }`}
          >
            {/* ── Media zone ─────────────────────────────────────────── */}
            <div className="relative h-52 overflow-hidden">
              {hasImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cat.image_urls[0]}
                    alt={cat.name}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                  />
                  {/* Bottom gradient for legibility */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-transparent" />
                </>
              ) : (
                <div
                  className="relative h-full w-full overflow-hidden"
                  style={{
                    background: `radial-gradient(120% 80% at 100% 0%, ${brandColor}38 0%, ${brandColor}1a 35%, ${brandColor}05 70%, #ffffff 100%)`,
                  }}
                >
                  {/* Decorative grain dots — subtle, hardware-cheap */}
                  <svg
                    className="absolute inset-0 h-full w-full opacity-[0.18] mix-blend-multiply"
                    aria-hidden
                  >
                    <defs>
                      <pattern id={`dots-${cat.id}`} width="14" height="14" patternUnits="userSpaceOnUse">
                        <circle cx="1" cy="1" r="1" fill={brandColor} />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill={`url(#dots-${cat.id})`} />
                  </svg>

                  {/* Sweeping highlight line */}
                  <div
                    className="absolute -left-10 top-10 h-px w-44 rotate-[-18deg] opacity-50"
                    style={{ background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)` }}
                  />

                  {/* Icon tile — bed glyph, replaces bare initial */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/70 backdrop-blur-md ring-1 ring-white/80 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.2)]"
                    >
                      <BedDouble
                        className="h-9 w-9"
                        style={{ color: brandColor }}
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Top-left: type chip in glass */}
              {typeLabel && (
                <div className="absolute left-3 top-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/85 backdrop-blur-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-700 ring-1 ring-black/5">
                    <BedDouble className="h-3 w-3" style={{ color: brandColor }} />
                    {typeLabel}
                  </span>
                </div>
              )}

              {/* Top-right: scarcity badge (single placement) */}
              {scarcityLevel(cat.available, cat.total) !== 'none' && (
                <div className="absolute right-3 top-3">
                  <ScarcityBadge available={cat.available} total={cat.total} variant="glass" />
                </div>
              )}

              {/* Bottom-left: capacity, sits on image */}
              <div className="absolute bottom-3 left-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 backdrop-blur-md px-2.5 py-1 text-[11px] font-medium text-gray-700 ring-1 ring-black/5">
                  <Users className="h-3 w-3" />
                  {cat.capacity} {cat.capacity === 1 ? 'guest' : 'guests'}
                </span>
              </div>
            </div>

            {/* ── Content zone ───────────────────────────────────────── */}
            <div className="flex flex-1 flex-col gap-4 p-5">
              {/* Title block */}
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-gray-900 leading-tight">
                  {cat.name}
                </h3>
                {cat.description && (
                  <p className="mt-1.5 text-[13px] text-gray-500 leading-relaxed line-clamp-2">
                    {cat.description}
                  </p>
                )}
              </div>

              {/* Amenities — refined: hairline ring, no fill */}
              {cat.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {cat.amenities.slice(0, 4).map(a => (
                    <span
                      key={a}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200 bg-white"
                    >
                      {AMENITY_ICONS[a.toLowerCase()] ?? null}
                      {a}
                    </span>
                  ))}
                  {cat.amenities.length > 4 && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-gray-500 ring-1 ring-gray-200 bg-gray-50">
                      +{cat.amenities.length - 4} more
                    </span>
                  )}
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Price + CTA. Hairline divider, editorial type contrast. */}
              <div className="space-y-4 border-t border-gray-100 pt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1">
                      <span className="text-[11px] font-medium text-gray-400">GH₵</span>
                      <span className="text-[26px] font-bold tracking-tight text-gray-900 leading-none tabular-nums">
                        {new Intl.NumberFormat('en-GH').format(cat.base_rate / 100)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-gray-400 font-medium">
                      {(RATE_LABEL[cat.rate_unit] ?? `/ ${cat.rate_unit}`).replace(/^\/\s*/, 'per ')}
                    </p>
                  </div>
                  {scarcityLevel(cat.available, cat.total) === 'none' && (
                    <div className="shrink-0 pt-1">
                      <ScarcityBadge available={cat.available} total={cat.total} />
                    </div>
                  )}
                </div>

                <button
                  disabled={sold}
                  onClick={() => onSelect(cat)}
                  className="group/btn relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.4)] transition-all duration-200 hover:shadow-[0_12px_28px_-8px_rgba(0,0,0,0.5)] hover:-translate-y-px disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  style={{ backgroundColor: brandColor }}
                >
                  {/* Subtle sheen on hover */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/15 opacity-0 transition-all duration-700 group-hover/btn:left-[120%] group-hover/btn:opacity-100"
                  />
                  {sold ? (
                    <>
                      <Clock className="h-4 w-4" />
                      Unavailable
                    </>
                  ) : (
                    <>
                      Book now
                      <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

/* ── Step 2 — Details Form ─────────────────────────────────────────────── */

interface FormData {
  first_name: string
  last_name: string
  phone: string
  email: string
  institution: string
  student_id: string
  check_in_date: string
  check_out_date: string
  notes: string
}

function CardSelector<T extends string | number>({
  options,
  value,
  onChange,
  brandColor,
}: {
  options: { value: T; label: string; desc?: string; icon: string }[]
  value: T | null
  onChange: (val: T) => void
  brandColor: string
}) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
      {options.map(opt => {
        const isSelected = value === opt.value
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value === value ? null as any : opt.value)}
            className="flex flex-col text-left p-4 rounded-xl border transition-all duration-200 focus:outline-none hover:shadow-sm"
            style={{
              borderColor: isSelected ? brandColor : '#E5E7EB',
              backgroundColor: isSelected ? `${brandColor}0a` : '#FFFFFF',
              boxShadow: isSelected ? `0 0 0 1px ${brandColor}` : undefined,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{opt.icon}</span>
              <span className="text-sm font-semibold text-gray-800">{opt.label}</span>
            </div>
            {opt.desc && (
              <span className="mt-1 text-[11px] text-gray-500 leading-normal">{opt.desc}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function CompactSelector<T extends string | number>({
  options,
  value,
  onChange,
  brandColor,
}: {
  options: { value: T; label: string; icon: string }[]
  value: T | null
  onChange: (val: T) => void
  brandColor: string
}) {
  return (
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
      {options.map(opt => {
        const isSelected = value === opt.value
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value === value ? null as any : opt.value)}
            className="flex items-center gap-2 text-left px-3 py-2.5 rounded-xl border transition-all duration-200 focus:outline-none hover:shadow-sm"
            style={{
              borderColor: isSelected ? brandColor : '#E5E7EB',
              backgroundColor: isSelected ? `${brandColor}0a` : '#FFFFFF',
              boxShadow: isSelected ? `0 0 0 1px ${brandColor}` : undefined,
            }}
          >
            <span className="text-lg">{opt.icon}</span>
            <span className="text-xs font-semibold text-gray-700">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function DetailsForm({
  category,
  brandColor,
  roommate_matching_enabled,
  onBack,
  onSubmit,
  loading,
}: {
  category: Category
  brandColor: string
  roommate_matching_enabled: boolean
  onBack: () => void
  onSubmit: (data: FormData & { matching_profile: OccupantMatchingProfile | null }) => void
  loading: boolean
}) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState<FormData>({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    institution: '',
    student_id: '',
    check_in_date: today,
    check_out_date: '',
    notes: '',
  })

  const [matchingProfile, setMatchingProfile] = useState<OccupantMatchingProfile>({
    cleanliness: null,
    sleep_schedule: null,
    study_preference: null,
    guest_frequency: null,
    noise_tolerance: null,
    ac_preference: null,
    hobbies: [],
    religion: null,
    religiosity_level: null,
    relationship_status: null,
  })

  const cleanlinessOptions = [
    { value: 1, label: 'Casual', desc: 'Relaxed about tidy spaces', icon: '🛋️' },
    { value: 2, label: 'Moderate', desc: 'Tidy but not obsessed', icon: '🧸' },
    { value: 3, label: 'Clean', desc: 'Keep things organized', icon: '🧼' },
    { value: 4, label: 'Very Neat', desc: 'Regular cleaning schedule', icon: '✨' },
    { value: 5, label: 'Spotless', desc: 'Highly organized/meticulous', icon: '🧹' },
  ]

  const sleepOptions = [
    { value: 'early_bird', label: 'Early Bird', desc: 'Sleep early, wake up early', icon: '🌅' },
    { value: 'night_owl', label: 'Night Owl', desc: 'Sleep late, wake up late', icon: '🦉' },
    { value: 'flexible', label: 'Flexible', desc: 'Varies day-to-day', icon: '🔄' },
  ]

  const studyOptions = [
    { value: 'in_room_quiet', label: 'Quiet Room', desc: 'Need silence in room', icon: '🤫' },
    { value: 'in_room_background_noise', label: 'BG Noise', desc: 'Fine with normal noise', icon: '🎧' },
    { value: 'library', label: 'Library/Desk', desc: 'Usually study elsewhere', icon: '🏫' },
  ]

  const guestOptions = [
    { value: 'none', label: 'No Guests', desc: 'Prefer a guest-free room', icon: '🚫' },
    { value: 'rare', label: 'Occasional', desc: 'Rare/short visits only', icon: '👥' },
    { value: 'frequent', label: 'Frequent', desc: 'Host friends/study groups', icon: '🎉' },
  ]

  const noiseOptions = [
    { value: 1, label: 'Silent', desc: 'Need absolute quiet to rest', icon: '🔇' },
    { value: 2, label: 'Low Noise', desc: 'Can handle quiet talk', icon: '🔉' },
    { value: 3, label: 'Moderate', desc: 'Average noise levels', icon: '🔊' },
    { value: 4, label: 'Loud', desc: 'Can handle active room', icon: '⚡' },
    { value: 5, label: 'Heavy', desc: 'Can sleep through anything', icon: '🎸' },
  ]

  const acOptions = [
    { value: 'ac_cold', label: 'Cold AC', desc: 'AC running cold preferred', icon: '❄️' },
    { value: 'fan_only', label: 'Fan Only', desc: 'Prefer fan or natural breeze', icon: '🌀' },
    { value: 'no_preference', label: 'No Preference', desc: 'Either is perfectly fine', icon: '🍃' },
  ]

  const religionOptions = [
    { value: 'christian', label: 'Christian', icon: '⛪' },
    { value: 'muslim', label: 'Muslim', icon: '🕌' },
    { value: 'traditional', label: 'Traditional', icon: '⛩️' },
    { value: 'other', label: 'Other', icon: '🕊️' },
    { value: 'none', label: 'None', icon: '🤷' },
    { value: 'prefer_not_to_say', label: 'Skip/Private', icon: '🤐' },
  ]

  const religiosityOptions = [
    { value: 'devout', label: 'Devout', desc: 'Faith shapes my daily routine', icon: '🔥' },
    { value: 'moderate', label: 'Moderate', desc: 'Observe core habits/holidays', icon: '⚖️' },
    { value: 'not_religious', label: 'Not Religious', desc: 'Values are secular/non-practicing', icon: '🌊' },
  ]

  const relationshipOptions = [
    { value: 'single', label: 'Single', icon: '👤' },
    { value: 'in_relationship', label: 'Relationship', icon: '💖' },
    { value: 'married', label: 'Married', icon: '💍' },
  ]

  const hobbyOptions = [
    'Gaming 🎮', 'Reading 📚', 'Fitness 🏋️', 'Cooking 🍳', 'Football ⚽', 
    'Music 🎵', 'Coding 💻', 'Art 🎨', 'Movies 🎬', 'Travel ✈️', 
    'Photography 📷', 'Writing ✍️', 'Dancing 💃', 'Anime ⛩️'
  ]

  function set(k: keyof FormData, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function toggleHobby(hobby: string) {
    setMatchingProfile(prev => {
      const hobbies = prev.hobbies || []
      if (hobbies.includes(hobby)) {
        return { ...prev, hobbies: hobbies.filter(h => h !== hobby) }
      } else {
        return { ...prev, hobbies: [...hobbies, hobby] }
      }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({
      ...form,
      matching_profile: roommate_matching_enabled && category.capacity > 1 ? matchingProfile : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Selected room summary */}
      <div
        className="rounded-xl border-l-4 px-4 py-3 bg-white shadow-sm"
        style={{ borderLeftColor: brandColor }}
      >
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Selected room</p>
        <p className="mt-0.5 font-semibold text-gray-900">{category.name}</p>
        <p className="text-sm text-gray-500">
          {formatGHS(category.base_rate)} {RATE_LABEL[category.rate_unit] ?? `/ ${category.rate_unit}`}
        </p>
      </div>

      {/* Stay dates */}
      <fieldset className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="px-1 text-sm font-semibold text-gray-700">Stay dates</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Check-in date <span className="text-red-500">*</span></label>
            <input
              type="date"
              required
              min={today}
              value={form.check_in_date}
              onChange={e => set('check_in_date', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
              style={{ ['--tw-ring-color' as string]: brandColor }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Check-out date <span className="text-red-500">*</span></label>
            <input
              type="date"
              required
              min={form.check_in_date || today}
              value={form.check_out_date}
              onChange={e => set('check_out_date', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
            />
          </div>
        </div>
      </fieldset>

      {/* Personal info */}
      <fieldset className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="px-1 text-sm font-semibold text-gray-700">Your details</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">First name <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              maxLength={100}
              value={form.first_name}
              onChange={e => set('first_name', e.target.value)}
              placeholder="Kwame"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Last name <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              maxLength={100}
              value={form.last_name}
              onChange={e => set('last_name', e.target.value)}
              placeholder="Mensah"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone number <span className="text-red-500">*</span></label>
            <input
              type="tel"
              required
              minLength={9}
              maxLength={20}
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="0244000000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email address <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="email"
              maxLength={200}
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="kwame@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
            />
          </div>
        </div>
      </fieldset>

      {/* Student info */}
      <fieldset className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="px-1 text-sm font-semibold text-gray-700">Student info <span className="text-gray-400 font-normal text-xs">(optional)</span></legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Institution / University</label>
            <input
              type="text"
              maxLength={200}
              value={form.institution}
              onChange={e => set('institution', e.target.value)}
              placeholder="University of Ghana"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Student ID</label>
            <input
              type="text"
              maxLength={50}
              value={form.student_id}
              onChange={e => set('student_id', e.target.value)}
              placeholder="10123456"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
            />
          </div>
        </div>
      </fieldset>

      {/* Roommate Matching Questionnaire (Optional) */}
      {roommate_matching_enabled && category.capacity > 1 && (
        <fieldset className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
          <legend className="px-1 text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <UsersRound className="h-4 w-4 text-indigo-500" />
            Roommate Matching Survey (Optional)
          </legend>
          <p className="text-xs text-gray-500 -mt-2">
            Answer these optional lifestyle questions to help us place you in a room with compatible roommates.
          </p>

          <div className="space-y-5">
            {/* Cleanliness */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-700">Cleanliness & Tidiness</label>
              <CardSelector
                options={cleanlinessOptions}
                value={matchingProfile.cleanliness}
                onChange={val => setMatchingProfile(p => ({ ...p, cleanliness: val }))}
                brandColor={brandColor}
              />
            </div>

            {/* Sleep Schedule */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-700">Sleep Schedule</label>
              <CardSelector
                options={sleepOptions}
                value={matchingProfile.sleep_schedule}
                onChange={val => setMatchingProfile(p => ({ ...p, sleep_schedule: val as any }))}
                brandColor={brandColor}
              />
            </div>

            {/* Study Preference */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-700">Study Preference</label>
              <CardSelector
                options={studyOptions}
                value={matchingProfile.study_preference}
                onChange={val => setMatchingProfile(p => ({ ...p, study_preference: val as any }))}
                brandColor={brandColor}
              />
            </div>

            {/* Guest Frequency */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-700">Guest Frequency</label>
              <CardSelector
                options={guestOptions}
                value={matchingProfile.guest_frequency}
                onChange={val => setMatchingProfile(p => ({ ...p, guest_frequency: val as any }))}
                brandColor={brandColor}
              />
            </div>

            {/* Noise Tolerance */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-700">Noise Tolerance</label>
              <CardSelector
                options={noiseOptions}
                value={matchingProfile.noise_tolerance}
                onChange={val => setMatchingProfile(p => ({ ...p, noise_tolerance: val }))}
                brandColor={brandColor}
              />
            </div>

            {/* AC & Air Preference */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-700">Air Conditioning Preference</label>
              <CardSelector
                options={acOptions}
                value={matchingProfile.ac_preference}
                onChange={val => setMatchingProfile(p => ({ ...p, ac_preference: val as any }))}
                brandColor={brandColor}
              />
            </div>

            <div className="border-t border-gray-100 pt-4 grid gap-4 sm:grid-cols-2">
              {/* Religion */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-700">Religion</label>
                <CompactSelector
                  options={religionOptions}
                  value={matchingProfile.religion}
                  onChange={val => setMatchingProfile(p => ({ ...p, religion: val as any }))}
                  brandColor={brandColor}
                />
              </div>

              {/* Relationship Status */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-700">Relationship/Marital Status</label>
                <CompactSelector
                  options={relationshipOptions}
                  value={matchingProfile.relationship_status}
                  onChange={val => setMatchingProfile(p => ({ ...p, relationship_status: val as any }))}
                  brandColor={brandColor}
                />
              </div>
            </div>

            {/* Religiosity Level */}
            {matchingProfile.religion && matchingProfile.religion !== 'none' && matchingProfile.religion !== 'prefer_not_to_say' && (
              <div className="space-y-2 border-t border-gray-100 pt-4">
                <label className="block text-xs font-semibold text-gray-700">Level of Religiosity</label>
                <CardSelector
                  options={religiosityOptions}
                  value={matchingProfile.religiosity_level}
                  onChange={val => setMatchingProfile(p => ({ ...p, religiosity_level: val as any }))}
                  brandColor={brandColor}
                />
              </div>
            )}

            {/* Hobbies */}
            <div className="space-y-2 border-t border-gray-100 pt-4">
              <label className="block text-xs font-semibold text-gray-700">Hobbies & Interests (Select multiple)</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {hobbyOptions.map(hobby => {
                  const isSelected = matchingProfile.hobbies?.includes(hobby)
                  return (
                    <button
                      key={hobby}
                      type="button"
                      onClick={() => toggleHobby(hobby)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 focus:outline-none"
                      style={{
                        borderColor: isSelected ? brandColor : '#E5E7EB',
                        backgroundColor: isSelected ? `${brandColor}15` : '#F9FAFB',
                        color: isSelected ? brandColor : '#4B5563',
                      }}
                    >
                      {hobby}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </fieldset>
      )}

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Additional notes <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea
          maxLength={500}
          rows={3}
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Any special requests or information…"
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ backgroundColor: brandColor }}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Submitting…
            </>
          ) : (
            <>
              Confirm booking
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </form>
  )
}

/* ── Step 3 — Confirmation ─────────────────────────────────────────────── */

interface BookingResult {
  booking_ref: string
  booking_id: string
  room_type: string
  check_in_date: string
  check_out_date: string
  amount: number
  rate_unit: string
  status: string
  payment: {
    authorization_url: string
    reference: string
    amount: number
  } | null
}

function Confirmation({
  result,
  tenantName,
  brandColor,
  phone,
}: {
  result: BookingResult
  tenantName: string
  brandColor: string
  phone: string
}) {
  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  }

  const waNumber = phone.replace(/\D/g, '').replace(/^0/, '233')
  const waText = encodeURIComponent(
    `Hi! I just made a booking at ${tenantName}.\nBooking ref: ${result.booking_ref}\nRoom: ${result.room_type}\nCheck-in: ${formatDate(result.check_in_date)}`
  )

  const canPayOnline = !!result.payment?.authorization_url

  return (
    <div className="text-center space-y-6">
      {/* Success icon */}
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: `${brandColor}15` }}>
        <Check className="h-8 w-8" style={{ color: brandColor }} />
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900">Booking Received!</h2>
        <p className="mt-1 text-sm text-gray-500">
          {canPayOnline
            ? 'Complete payment now to confirm your room. We accept Mobile Money, Card and Bank Transfer.'
            : 'The hostel will contact you to arrange payment and check-in.'}
        </p>
      </div>

      {/* Booking card */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm text-left overflow-hidden">
        <div className="px-5 py-3" style={{ backgroundColor: `${brandColor}10` }}>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Booking reference</p>
          <p className="text-2xl font-bold tracking-wider" style={{ color: brandColor }}>{result.booking_ref}</p>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm">
          <Row label="Room type" value={result.room_type} />
          <Row label="Check-in" value={formatDate(result.check_in_date)} />
          <Row label="Check-out" value={formatDate(result.check_out_date)} />
          <Row
            label="Amount due"
            value={`${formatGHS(result.amount)} ${RATE_LABEL[result.rate_unit] ?? `/ ${result.rate_unit}`}`}
            bold
          />
          <Row
            label="Status"
            value="Pending payment"
            pill
            pillColor="bg-amber-100 text-amber-700"
          />
        </div>
      </div>

      {/* Online payment CTA */}
      {canPayOnline && (
        <a
          href={result.payment!.authorization_url}
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: brandColor }}
        >
          Pay {formatGHS(result.payment!.amount)} now
          <ChevronRight className="h-4 w-4" />
        </a>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href={`https://wa.me/${waNumber}?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 px-5 py-2.5 text-sm font-semibold transition-colors hover:opacity-90"
          style={{ borderColor: brandColor, color: brandColor }}
        >
          <Share2 className="h-4 w-4" />
          Share via WhatsApp
        </a>
        <a
          href={`tel:`}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: brandColor }}
        >
          <Phone className="h-4 w-4" />
          Contact hostel
        </a>
      </div>

      <p className="text-xs text-gray-400">
        Save your booking reference <strong>{result.booking_ref}</strong> — you&apos;ll need it at check-in.
      </p>
    </div>
  )
}

function Row({
  label,
  value,
  bold,
  pill,
  pillColor,
}: {
  label: string
  value: string
  bold?: boolean
  pill?: boolean
  pillColor?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      {pill ? (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${pillColor}`}>{value}</span>
      ) : (
        <span className={bold ? 'font-bold text-gray-900' : 'text-gray-900'}>{value}</span>
      )}
    </div>
  )
}

/* ── Progress indicator ────────────────────────────────────────────────── */

function Steps({ current, brandColor }: { current: number; brandColor: string }) {
  const steps = ['Choose room', 'Your details', 'Confirmation']
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1
        const done = idx < current
        const active = idx === current
        return (
          <div key={idx} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  done ? 'text-white' : active ? 'text-white' : 'bg-gray-200 text-gray-400'
                }`}
                style={done || active ? { backgroundColor: brandColor } : undefined}
              >
                {done ? <Check className="h-4 w-4" /> : idx}
              </div>
              <span className={`mt-1 text-xs font-medium ${active ? 'text-gray-900' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="flex-1 h-0.5 mx-2 mb-5 transition-all"
                style={{ backgroundColor: done ? brandColor : '#E5E7EB' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Main component ────────────────────────────────────────────────────── */

export function BookingFlow({ categories, tenant }: BookingFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BookingResult | null>(null)
  const [submittedPhone, setSubmittedPhone] = useState('')
  const [payStatus, setPayStatus] = useState<'success' | 'failed' | 'error' | null>(null)

  // Read ?pay=success|failed|error after Paystack redirects back
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const p = sp.get('pay')
    if (p === 'success' || p === 'failed' || p === 'error') {
      setPayStatus(p)
      // Clean URL so banner doesn't reappear on refresh
      const url = new URL(window.location.href)
      url.searchParams.delete('pay')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  async function handleSubmit(data: FormData & { matching_profile?: OccupantMatchingProfile | null }) {
    if (!selectedCategory) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/public/${tenant.slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id:    selectedCategory.id,
          check_in_date:  data.check_in_date,
          check_out_date: data.check_out_date,
          first_name:     data.first_name,
          last_name:      data.last_name,
          phone:          data.phone,
          email:          data.email || null,
          institution:    data.institution || null,
          student_id:     data.student_id || null,
          notes:          data.notes || null,
          matching_profile: data.matching_profile || null,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        const msg = typeof json.error === 'string'
          ? json.error
          : 'Booking failed. Please try again or contact the hostel.'
        setError(msg)
        return
      }

      setResult(json)
      setSubmittedPhone(data.phone)
      setStep(3)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Steps current={step} brandColor={tenant.brandColor} />

      {payStatus === 'success' && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          ✓ Payment received. Your booking is confirmed — see your inbox/SMS for the receipt.
        </div>
      )}
      {payStatus === 'failed' && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Payment was not completed. Start a new booking or contact the hostel to pay manually.
        </div>
      )}
      {payStatus === 'error' && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Something went wrong while verifying your payment. Please contact the hostel with your booking reference.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 1 && (
        <RoomPicker
          categories={categories}
          brandColor={tenant.brandColor}
          onSelect={cat => {
            setSelectedCategory(cat)
            setStep(2)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      )}

      {step === 2 && selectedCategory && (
        <DetailsForm
          category={selectedCategory}
          brandColor={tenant.brandColor}
          roommate_matching_enabled={tenant.roommate_matching_enabled ?? false}
          loading={loading}
          onBack={() => setStep(1)}
          onSubmit={handleSubmit}
        />
      )}

      {step === 3 && result && (
        <Confirmation
          result={result}
          tenantName={tenant.name}
          brandColor={tenant.brandColor}
          phone={submittedPhone}
        />
      )}
    </div>
  )
}
