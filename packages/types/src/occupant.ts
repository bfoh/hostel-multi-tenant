// ── Occupants ─────────────────────────────────────────────────────────────────

export type OccupantType = 'student' | 'professional' | 'guest' | 'staff'

export type OccupantStatus = 'active' | 'checked_out' | 'pending' | 'suspended' | 'blacklisted'

export type GenderType = 'male' | 'female' | 'prefer_not_to_say'

export interface EmergencyContact {
  name: string
  relationship: string
  phone: string
}

export interface Occupant {
  id: string
  tenantId: string
  type: OccupantType
  status: OccupantStatus

  // Personal details
  firstName: string
  lastName: string
  otherNames: string | null
  gender: GenderType
  dateOfBirth: string | null
  nationalIdType: 'ghana_card' | 'passport' | 'voters_id' | 'nhis' | null
  nationalIdNumber: string | null
  photoUrl: string | null

  // Contact
  phone: string
  alternatePhone: string | null
  email: string | null
  homeAddress: string | null
  regionOfOrigin: string | null  // Ghana region

  // Student-specific
  institution: string | null
  studentId: string | null
  programme: string | null
  yearOfStudy: number | null
  semester: 'first' | 'second' | 'summer' | null

  emergencyContact: EmergencyContact | null

  notes: string | null
  createdAt: string
  updatedAt: string
}
