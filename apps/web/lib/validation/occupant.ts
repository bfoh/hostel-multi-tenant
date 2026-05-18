import { z } from 'zod'

export const occupantSchema = z.object({
  first_name:         z.string().min(1).max(100),
  last_name:          z.string().min(1).max(100),
  other_names:        z.string().max(100).nullable().optional(),
  phone:              z.string().min(10).max(15),
  alternate_phone:    z.string().max(15).nullable().optional(),
  email:              z.string().email().nullable().optional(),
  gender:             z.enum(['male', 'female', 'prefer_not_to_say']).nullable().optional(),
  date_of_birth:      z.string().nullable().optional(),
  type:               z.enum(['student', 'professional', 'guest', 'staff']),
  national_id_type:   z.enum(['ghana_card', 'passport', 'voters_id', 'nhis']).nullable().optional(),
  national_id_number: z.string().max(50).nullable().optional(),
  institution:        z.string().max(200).nullable().optional(),
  student_id:         z.string().max(50).nullable().optional(),
  programme:          z.string().max(200).nullable().optional(),
  year_of_study:      z.number().int().min(1).max(10).nullable().optional(),
  semester:           z.enum(['first', 'second', 'summer']).nullable().optional(),
  home_address:       z.string().max(300).nullable().optional(),
  region_of_origin:   z.string().nullable().optional(),
  emergency_contact:  z.record(z.string()).nullable().optional(),
  notes:              z.string().max(500).nullable().optional(),
})

export type OccupantInput = z.infer<typeof occupantSchema>

export const OCCUPANT_BULK_HEADERS = [
  'first_name',
  'last_name',
  'other_names',
  'phone',
  'alternate_phone',
  'email',
  'gender',
  'date_of_birth',
  'type',
  'national_id_type',
  'national_id_number',
  'institution',
  'student_id',
  'programme',
  'year_of_study',
  'semester',
  'home_address',
  'region_of_origin',
  'notes',
] as const

export const OCCUPANT_REQUIRED_HEADERS = ['first_name', 'last_name', 'phone', 'type'] as const

const GENDER_MAP: Record<string, 'male' | 'female' | 'prefer_not_to_say'> = {
  male: 'male',
  m: 'male',
  female: 'female',
  f: 'female',
  prefer_not_to_say: 'prefer_not_to_say',
  pnts: 'prefer_not_to_say',
}

const TYPE_MAP: Record<string, 'student' | 'professional' | 'guest' | 'staff'> = {
  student: 'student',
  professional: 'professional',
  guest: 'guest',
  staff: 'staff',
}

const NID_MAP: Record<string, 'ghana_card' | 'passport' | 'voters_id' | 'nhis'> = {
  ghana_card: 'ghana_card',
  ghana: 'ghana_card',
  passport: 'passport',
  voters_id: 'voters_id',
  voters: 'voters_id',
  voter: 'voters_id',
  nhis: 'nhis',
}

const SEMESTER_MAP: Record<string, 'first' | 'second' | 'summer'> = {
  first: 'first',
  '1': 'first',
  '1st': 'first',
  second: 'second',
  '2': 'second',
  '2nd': 'second',
  summer: 'summer',
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

/**
 * Coerce a raw row (string-ish values from xlsx/csv) into the shape the zod schema expects.
 * Returns the candidate object; caller runs zod for final validation.
 */
export function coerceOccupantRow(raw: Record<string, unknown>): Record<string, unknown> {
  const lower: Record<string, unknown> = {}
  for (const k of Object.keys(raw)) {
    lower[k.toLowerCase().trim()] = raw[k]
  }

  const gender = clean(lower.gender)?.toLowerCase()
  const type = clean(lower.type)?.toLowerCase()
  const nid = clean(lower.national_id_type)?.toLowerCase().replace(/[\s-]/g, '_')
  const sem = clean(lower.semester)?.toLowerCase()

  const yearRaw = clean(lower.year_of_study)
  const year = yearRaw ? Number.parseInt(yearRaw, 10) : null

  return {
    first_name:         clean(lower.first_name) ?? '',
    last_name:          clean(lower.last_name) ?? '',
    other_names:        clean(lower.other_names),
    phone:              normalizePhone(lower.phone) ?? '',
    alternate_phone:    normalizePhone(lower.alternate_phone),
    email:              clean(lower.email),
    gender:             gender ? GENDER_MAP[gender] ?? null : null,
    date_of_birth:      clean(lower.date_of_birth),
    type:               (type ? TYPE_MAP[type] : null) ?? 'student',
    national_id_type:   nid ? NID_MAP[nid] ?? null : null,
    national_id_number: clean(lower.national_id_number),
    institution:        clean(lower.institution),
    student_id:         clean(lower.student_id),
    programme:          clean(lower.programme),
    year_of_study:      year && Number.isFinite(year) ? year : null,
    semester:           sem ? SEMESTER_MAP[sem] ?? null : null,
    home_address:       clean(lower.home_address),
    region_of_origin:   clean(lower.region_of_origin),
    notes:              clean(lower.notes),
  }
}
