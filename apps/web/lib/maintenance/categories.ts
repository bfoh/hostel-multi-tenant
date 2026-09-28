/**
 * Single source of truth for maintenance_category — previously duplicated
 * ad hoc across three API route zod schemas and the guest-facing portal's
 * own option list. Broadened (migration 134) beyond pure maintenance so
 * the existing guest "Report Issue" flow / staff queue can also cover
 * non-maintenance service requests (housekeeping asks, transport, food,
 * general amenity requests) without a parallel table.
 */
export const MAINTENANCE_CATEGORIES = [
  'plumbing', 'electrical', 'hvac', 'structural', 'cleaning',
  'furniture', 'appliance', 'pest_control', 'security', 'other',
  'housekeeping', 'transport', 'food', 'amenity',
] as const

export type MaintenanceCategory = typeof MAINTENANCE_CATEGORIES[number]

export const MAINTENANCE_CATEGORY_LABEL: Record<MaintenanceCategory, string> = {
  plumbing:      'Plumbing',
  electrical:    'Electrical',
  hvac:          'HVAC',
  structural:    'Structural',
  cleaning:      'Cleaning',
  furniture:     'Furniture',
  appliance:     'Appliance',
  pest_control:  'Pest Control',
  security:      'Security',
  other:         'Other',
  housekeeping:  'Housekeeping (towels, toiletries…)',
  transport:     'Transport (taxi, airport pickup)',
  food:          'Food & Beverage',
  amenity:       'Amenity request (pillow, iron, etc.)',
}

/**
 * Guest-facing subset, shown on the self-service "Report Issue" tab —
 * matches the pre-existing list plus the new non-maintenance categories,
 * omitting internal-only ones (hvac, security) that a guest has no reason
 * to select.
 */
export const GUEST_MAINTENANCE_CATEGORIES: MaintenanceCategory[] = [
  'housekeeping', 'amenity', 'transport', 'food',
  'plumbing', 'electrical', 'furniture', 'appliance', 'cleaning', 'pest_control', 'structural', 'other',
]
