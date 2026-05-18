import { z } from 'zod'

export const bookingImportRowSchema = z.object({
  occupant_phone:    z.string().min(10).max(15).nullable().optional(),
  occupant_student_id: z.string().max(50).nullable().optional(),
  room_number:       z.string().min(1).max(50),
  check_in_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  check_out_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  source:            z.enum(['walk_in', 'phone', 'website', 'widget', 'voice_ai', 'referral']),
  semester:          z.string().max(50).nullable().optional(),
  academic_year:     z.string().max(20).nullable().optional(),
  discount_amount:   z.number().int().min(0).default(0),
  discount_reason:   z.string().max(200).nullable().optional(),
  notes:             z.string().max(500).nullable().optional(),
}).refine(
  (v) => Boolean(v.occupant_phone || v.occupant_student_id),
  { message: 'Either occupant_phone or occupant_student_id required', path: ['occupant_phone'] },
).refine(
  (v) => v.check_out_date > v.check_in_date,
  { message: 'check_out_date must be after check_in_date', path: ['check_out_date'] },
)

export type BookingImportRow = z.infer<typeof bookingImportRowSchema>

export const BOOKING_BULK_HEADERS = [
  'occupant_phone',
  'occupant_student_id',
  'room_number',
  'check_in_date',
  'check_out_date',
  'source',
  'semester',
  'academic_year',
  'discount_amount',
  'discount_reason',
  'notes',
] as const

export const BOOKING_REQUIRED_HEADERS = [
  'room_number',
  'check_in_date',
  'check_out_date',
  'source',
] as const

const SOURCE_MAP: Record<string, BookingImportRow['source']> = {
  walk_in: 'walk_in',
  walkin: 'walk_in',
  'walk-in': 'walk_in',
  phone: 'phone',
  website: 'website',
  widget: 'widget',
  voice_ai: 'voice_ai',
  voiceai: 'voice_ai',
  referral: 'referral',
}

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length ? s : null
}

function normalizePhone(v: unknown): string | null {
  const s = clean(v)
  if (!s) return null
  return s.replace(/[\s\-()]/g, '')
}

function toIsoDate(v: unknown): string | null {
  const s = clean(v)
  if (!s) return null
  // already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // ISO datetime (xlsx cellDates may produce these)
  const iso = /^(\d{4}-\d{2}-\d{2})T/.exec(s)
  if (iso) return iso[1]
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // MM/DD/YYYY fallback — only if first part > 12 we treat as DD/MM (handled above)
  return s
}

function toInt(v: unknown): number {
  const s = clean(v)
  if (!s) return 0
  const n = Number.parseInt(s.replace(/[,\s]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

export function coerceBookingRow(raw: Record<string, unknown>): Record<string, unknown> {
  const lower: Record<string, unknown> = {}
  for (const k of Object.keys(raw)) {
    lower[k.toLowerCase().trim()] = raw[k]
  }

  const sourceRaw = clean(lower.source)?.toLowerCase().replace(/\s/g, '_')

  return {
    occupant_phone:      normalizePhone(lower.occupant_phone),
    occupant_student_id: clean(lower.occupant_student_id),
    room_number:         clean(lower.room_number) ?? '',
    check_in_date:       toIsoDate(lower.check_in_date) ?? '',
    check_out_date:      toIsoDate(lower.check_out_date) ?? '',
    source:              (sourceRaw ? SOURCE_MAP[sourceRaw] : null) ?? 'walk_in',
    semester:            clean(lower.semester),
    academic_year:       clean(lower.academic_year),
    discount_amount:     toInt(lower.discount_amount),
    discount_reason:     clean(lower.discount_reason),
    notes:               clean(lower.notes),
  }
}
