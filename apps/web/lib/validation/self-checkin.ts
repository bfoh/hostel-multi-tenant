import { z } from 'zod'

export const selfCheckinSchema = z.object({
  first_name:     z.string().min(1).max(100),
  last_name:      z.string().min(1).max(100),
  phone:          z.string().min(10).max(15),
  email:          z.string().email().nullable().optional(),
  gender:         z.enum(['male', 'female', 'prefer_not_to_say']).nullable().optional(),
  institution:    z.string().max(200).nullable().optional(),
  student_id:     z.string().max(50).nullable().optional(),
  programme:      z.string().max(200).nullable().optional(),
  emergency_contact_name:  z.string().max(120).nullable().optional(),
  emergency_contact_phone: z.string().max(20).nullable().optional(),
  category_id:    z.string().uuid(),
  /** Optional explicit room pick. When supplied, server validates it belongs
      to category_id and has free_beds > 0. Otherwise server auto-picks. */
  room_id:        z.string().uuid().nullable().optional(),
  /** UI-only label e.g. "Bed 2". Persisted to bookings.notes appendix; not a
      hard reference because the rooms schema doesn't model individual beds. */
  bed_label:      z.string().max(40).nullable().optional(),
  check_in_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes:          z.string().max(500).nullable().optional(),
})

export type SelfCheckinInput = z.infer<typeof selfCheckinSchema>

export const GHANA_CARD_MAX_BYTES = 5 * 1024 * 1024 // 5MB
export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const
