// ── Rooms & Facilities ────────────────────────────────────────────────────────

export type RoomType =
  | 'single'
  | 'double'
  | 'twin'
  | 'triple'
  | 'quad'
  | 'dormitory'
  | 'suite'
  | 'studio'

export type RoomStatus = 'available' | 'occupied' | 'reserved' | 'maintenance' | 'blocked'

export type HousekeepingStatus = 'clean' | 'dirty' | 'inspecting' | 'out_of_order'

export interface RoomCategory {
  id: string
  tenantId: string
  name: string              // e.g. "Executive Single", "Standard Double"
  type: RoomType
  baseRate: number          // base nightly / semester rate in pesewas (GHS * 100)
  capacity: number
  amenities: string[]       // ["AC", "WiFi", "En-suite", "Balcony", ...]
  description: string | null
  imageUrls: string[]
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Room {
  id: string
  tenantId: string
  categoryId: string
  roomNumber: string        // e.g. "A101", "Block B Room 12"
  floor: number | null
  block: string | null
  status: RoomStatus
  housekeepingStatus: HousekeepingStatus
  notes: string | null
  lastCleanedAt: string | null
  lastInspectedAt: string | null
  createdAt: string
  updatedAt: string

  // Joined fields (not always present)
  category?: RoomCategory
}

export interface RoomWithOccupancy extends Room {
  currentOccupantId: string | null
  currentOccupantName: string | null
  checkInDate: string | null
  checkOutDate: string | null
}
