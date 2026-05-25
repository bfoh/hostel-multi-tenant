'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Sparkles, User, Calendar, ArrowRight, Search, 
  CheckCircle2, AlertTriangle, XCircle, Info, Settings, 
  Loader2, Home, Users, Check, AlertCircle, RefreshCw
} from 'lucide-react'
import { calculateCompatibility, calculateRoomHarmonyScore, type OccupantMatchingProfile } from '@/lib/matching'

interface Occupant {
  id: string
  first_name: string
  last_name: string
  other_names: string | null
  phone: string
  email: string | null
  student_id: string | null
  institution: string | null
}

interface Booking {
  id: string
  status: string
  check_in_date: string
  check_out_date: string
  occupant_id: string
  room_id: string | null
  booking_ref: string
  occupant: Occupant | null
}

interface RoomCategory {
  id: string
  name: string
  type: string
  capacity: number
  base_rate: number
  rate_unit: string
}

interface Room {
  id: string
  room_number: string
  block: string | null
  floor: number | null
  status: string
  category: RoomCategory | RoomCategory[] | null
}

interface Props {
  rooms: Room[]
  bookings: Booking[]
  profiles: OccupantMatchingProfile[]
  matchingEnabled: boolean
}

export function MatchingDashboard({ rooms, bookings, profiles, matchingEnabled }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  // UI States
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [blockFilter, setBlockFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  
  // Dialog / Drawer States
  const [compareRoomId, setCompareRoomId] = useState<string | null>(null)
  const [isConfirmingReassign, setIsConfirmingReassign] = useState(false)
  const [targetRoomId, setTargetRoomId] = useState<string | null>(null)
  const [reassignReason, setReassignReason] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Map profile details for lookup
  const profileMap = useMemo(() => {
    return new Map<string, OccupantMatchingProfile>(
      profiles.map(p => [p.occupant_id!, p])
    )
  }, [profiles])

  // Get active rooms (capacity > 1)
  const sharedRooms = useMemo(() => {
    return rooms.filter(room => {
      const cat = Array.isArray(room.category) ? room.category[0] : room.category
      return cat && cat.capacity > 1
    })
  }, [rooms])

  // Get list of unique blocks for filtering
  const blocks = useMemo(() => {
    const set = new Set(rooms.map(r => r.block).filter(Boolean))
    return Array.from(set) as string[]
  }, [rooms])

  // Get list of shared room categories for filtering
  const categories = useMemo(() => {
    const list: { id: string; name: string }[] = []
    const ids = new Set<string>()
    rooms.forEach(r => {
      const cat = Array.isArray(r.category) ? r.category[0] : r.category
      if (cat && cat.capacity > 1 && !ids.has(cat.id)) {
        ids.add(cat.id)
        list.push({ id: cat.id, name: cat.name })
      }
    })
    return list
  }, [rooms])

  // Map of room_id to active bookings currently in that room
  const activeBookingsByRoom = useMemo(() => {
    const map = new Map<string, Booking[]>()
    bookings.forEach(b => {
      if (b.room_id) {
        const list = map.get(b.room_id) ?? []
        list.push(b)
        map.set(b.room_id, list)
      }
    })
    return map
  }, [bookings])

  // Selected Booking
  const selectedBooking = useMemo(() => {
    return bookings.find(b => b.id === selectedBookingId) ?? null
  }, [bookings, selectedBookingId])

  const selectedProfile = useMemo(() => {
    if (!selectedBooking) return null
    return profileMap.get(selectedBooking.occupant_id) ?? null
  }, [selectedBooking, profileMap])

  // List of incoming / unassigned bookings for shared rooms
  // Unassigned in this workspace = bookings that are for a shared category, and status is pending_payment or confirmed
  const pendingBookings = useMemo(() => {
    return bookings.filter(b => {
      // Find room category capacity
      let isShared = false
      if (b.room_id) {
        const room = rooms.find(r => r.id === b.room_id)
        const cat = room ? (Array.isArray(room.category) ? room.category[0] : room.category) : null
        isShared = cat ? cat.capacity > 1 : false
      } else {
        // If room_id is null, check category or default to true for waitlists
        isShared = true
      }

      const notCheckedIn = ['pending_payment', 'confirmed'].includes(b.status)
      const name = `${b.occupant?.first_name ?? ''} ${b.occupant?.last_name ?? ''}`.toLowerCase()
      const queryMatches = name.includes(searchQuery.toLowerCase()) || (b.booking_ref.toLowerCase().includes(searchQuery.toLowerCase()))

      return isShared && notCheckedIn && queryMatches
    })
  }, [bookings, rooms, searchQuery])

  // Date overlapping helper
  function doDatesOverlap(checkIn1: string, checkOut1: string, checkIn2: string, checkOut2: string) {
    return checkIn1 <= checkOut2 && checkOut1 >= checkIn2
  }

  // Calculate compatibility mapping for the selected booking against all shared rooms
  const roomCompatibilityScores = useMemo(() => {
    if (!selectedBooking) return new Map<string, { score: number; overlapsCount: number; isFull: boolean; conflictingBedsCount: number }>()

    const map = new Map<string, { score: number; overlapsCount: number; isFull: boolean; conflictingBedsCount: number }>()

    sharedRooms.forEach(room => {
      const cat = Array.isArray(room.category) ? room.category[0] : room.category
      const capacity = cat?.capacity ?? 1

      // Find current occupants in this room that overlap with selected booking's dates
      const roomBookings = activeBookingsByRoom.get(room.id) ?? []
      const overlappingBookings = roomBookings.filter(b => 
        b.id !== selectedBooking.id && 
        doDatesOverlap(selectedBooking.check_in_date, selectedBooking.check_out_date, b.check_in_date, b.check_out_date)
      )

      const profilesInRoom = overlappingBookings
        .map(b => profileMap.get(b.occupant_id))
        .filter(Boolean) as OccupantMatchingProfile[]

      const score = calculateRoomHarmonyScore(selectedProfile, profilesInRoom)
      const isFull = overlappingBookings.length >= capacity

      map.set(room.id, {
        score,
        overlapsCount: overlappingBookings.length,
        isFull,
        conflictingBedsCount: overlappingBookings.length
      })
    })

    return map
  }, [selectedBooking, selectedProfile, sharedRooms, activeBookingsByRoom, profileMap])

  // Filtered rooms grid
  const filteredRooms = useMemo(() => {
    return sharedRooms.filter(room => {
      const cat = Array.isArray(room.category) ? room.category[0] : room.category
      if (!cat) return false
      
      const blockMatches = blockFilter === 'all' || room.block === blockFilter
      const catMatches = categoryFilter === 'all' || cat.id === categoryFilter
      
      return blockMatches && catMatches
    })
  }, [sharedRooms, blockFilter, categoryFilter])

  // Handle reassigning room
  async function executeReassignment() {
    if (!selectedBookingId || !targetRoomId) return
    setErrorMsg(null)

    const res = await fetch(`/api/bookings/${selectedBookingId}/reassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: targetRoomId,
        reason: reassignReason,
      })
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setErrorMsg(data.error ?? 'Failed to reassign room.')
    } else {
      setIsConfirmingReassign(false)
      setCompareRoomId(null)
      setSelectedBookingId(null)
      setTargetRoomId(null)
      setReassignReason('')
      startTransition(() => {
        router.refresh()
      })
    }
  }

  // Conflict and Friction analyzer helper
  const frictionAnalysis = useMemo(() => {
    if (!selectedBooking || !compareRoomId) return []
    const room = sharedRooms.find(r => r.id === compareRoomId)
    if (!room) return []

    const roomBookings = activeBookingsByRoom.get(room.id) ?? []
    const overlappingBookings = roomBookings.filter(b => 
      b.id !== selectedBooking.id && 
      doDatesOverlap(selectedBooking.check_in_date, selectedBooking.check_out_date, b.check_in_date, b.check_out_date)
    )

    const analysis: {
      label: string
      guestVal: string
      roommateVals: { name: string; val: string }[]
      severity: 'none' | 'warning' | 'danger'
      explanation: string
    }[] = []

    const gProf = selectedProfile ?? {
      cleanliness: null, sleep_schedule: null, study_preference: null,
      guest_frequency: null, noise_tolerance: null, ac_preference: null,
      hobbies: [], religion: null, religiosity_level: null, relationship_status: null
    }

    // Cleanliness (Scale 1-5)
    if (typeof gProf.cleanliness === 'number') {
      const roommates = overlappingBookings.map(b => {
        const p = profileMap.get(b.occupant_id)
        return {
          name: `${b.occupant?.first_name} ${b.occupant?.last_name}`,
          val: p?.cleanliness ? `${p.cleanliness}/5 Cleanliness` : 'Unspecified'
        }
      })
      
      let severity: 'none' | 'warning' | 'danger' = 'none'
      let explanation = 'Cleanliness preferences are compatible.'
      
      const maxDiff = Math.max(...overlappingBookings.map(b => {
        const p = profileMap.get(b.occupant_id)
        return p?.cleanliness ? Math.abs(gProf.cleanliness! - p.cleanliness) : 0
      }), 0)

      if (maxDiff >= 3) {
        severity = 'danger'
        explanation = 'Significant difference in cleanliness habits. Messy vs neat conflicts may occur.'
      } else if (maxDiff >= 2) {
        severity = 'warning'
        explanation = 'Moderate difference in cleanliness. Simple communication is advised.'
      }

      analysis.push({
        label: 'Cleanliness Habit',
        guestVal: `${gProf.cleanliness}/5 Cleanliness`,
        roommateVals: roommates,
        severity,
        explanation
      })
    }

    // Sleep Schedule
    if (gProf.sleep_schedule) {
      const roommates = overlappingBookings.map(b => {
        const p = profileMap.get(b.occupant_id)
        return {
          name: `${b.occupant?.first_name} ${b.occupant?.last_name}`,
          val: p?.sleep_schedule ? p.sleep_schedule.replace('_', ' ') : 'Unspecified'
        }
      })

      let severity: 'none' | 'warning' | 'danger' = 'none'
      let explanation = 'Sleep schedules are compatible.'

      const hasOpposite = overlappingBookings.some(b => {
        const p = profileMap.get(b.occupant_id)
        return p?.sleep_schedule && (
          (gProf.sleep_schedule === 'early_bird' && p.sleep_schedule === 'night_owl') ||
          (gProf.sleep_schedule === 'night_owl' && p.sleep_schedule === 'early_bird')
        )
      })

      if (hasOpposite) {
        severity = 'danger'
        explanation = 'Opposing sleep schedules (Early Bird vs Night Owl). High risk of noise or light disturbance.'
      }

      analysis.push({
        label: 'Sleep Schedule',
        guestVal: gProf.sleep_schedule.replace('_', ' '),
        roommateVals: roommates,
        severity,
        explanation
      })
    }

    // Study Preference
    if (gProf.study_preference) {
      const roommates = overlappingBookings.map(b => {
        const p = profileMap.get(b.occupant_id)
        return {
          name: `${b.occupant?.first_name} ${b.occupant?.last_name}`,
          val: p?.study_preference ? p.study_preference.replace(/_/g, ' ') : 'Unspecified'
        }
      })

      let severity: 'none' | 'warning' | 'danger' = 'none'
      let explanation = 'Study preferences are compatible.'

      const hasConflict = overlappingBookings.some(b => {
        const p = profileMap.get(b.occupant_id)
        return p?.study_preference && (
          (gProf.study_preference === 'in_room_quiet' && p.study_preference === 'in_room_background_noise') ||
          (gProf.study_preference === 'in_room_background_noise' && p.study_preference === 'in_room_quiet')
        )
      })

      if (hasConflict) {
        severity = 'danger'
        explanation = 'Study noise conflict. One roommate requires silence, another prefers background noise.'
      }

      analysis.push({
        label: 'Study Habits',
        guestVal: gProf.study_preference.replace(/_/g, ' '),
        roommateVals: roommates,
        severity,
        explanation
      })
    }

    // Guest Frequency
    if (gProf.guest_frequency) {
      const roommates = overlappingBookings.map(b => {
        const p = profileMap.get(b.occupant_id)
        return {
          name: `${b.occupant?.first_name} ${b.occupant?.last_name}`,
          val: p?.guest_frequency ? p.guest_frequency : 'Unspecified'
        }
      })

      let severity: 'none' | 'warning' | 'danger' = 'none'
      let explanation = 'Guest preferences are compatible.'

      const hasExtreme = overlappingBookings.some(b => {
        const p = profileMap.get(b.occupant_id)
        return p?.guest_frequency && (
          (gProf.guest_frequency === 'none' && p.guest_frequency === 'frequent') ||
          (gProf.guest_frequency === 'frequent' && p.guest_frequency === 'none')
        )
      })

      if (hasExtreme) {
        severity = 'danger'
        explanation = 'Extreme visitor conflict. One roommate prefers no guests, another welcomes frequent guests.'
      } else if (gProf.guest_frequency === 'frequent' || overlappingBookings.some(b => profileMap.get(b.occupant_id)?.guest_frequency === 'frequent')) {
        severity = 'warning'
        explanation = 'Frequent visitors may create noise or space concerns.'
      }

      analysis.push({
        label: 'Guest Tolerance',
        guestVal: gProf.guest_frequency,
        roommateVals: roommates,
        severity,
        explanation
      })
    }

    // Noise Tolerance (1-5)
    if (typeof gProf.noise_tolerance === 'number') {
      const roommates = overlappingBookings.map(b => {
        const p = profileMap.get(b.occupant_id)
        return {
          name: `${b.occupant?.first_name} ${b.occupant?.last_name}`,
          val: p?.noise_tolerance ? `${p.noise_tolerance}/5 Tolerance` : 'Unspecified'
        }
      })

      let severity: 'none' | 'warning' | 'danger' = 'none'
      let explanation = 'Noise tolerance is aligned.'

      const maxDiff = Math.max(...overlappingBookings.map(b => {
        const p = profileMap.get(b.occupant_id)
        return p?.noise_tolerance ? Math.abs(gProf.noise_tolerance! - p.noise_tolerance) : 0
      }), 0)

      if (maxDiff >= 3) {
        severity = 'danger'
        explanation = 'High noise tolerance mismatch. Might lead to noise complaints or tension.'
      } else if (maxDiff >= 2) {
        severity = 'warning'
        explanation = 'Slight difference in noise tolerance. Respectful boundaries should resolve it.'
      }

      analysis.push({
        label: 'Noise Tolerance',
        guestVal: `${gProf.noise_tolerance}/5 Tolerance`,
        roommateVals: roommates,
        severity,
        explanation
      })
    }

    // AC Preference
    if (gProf.ac_preference) {
      const roommates = overlappingBookings.map(b => {
        const p = profileMap.get(b.occupant_id)
        return {
          name: `${b.occupant?.first_name} ${b.occupant?.last_name}`,
          val: p?.ac_preference ? p.ac_preference.replace(/_/g, ' ') : 'Unspecified'
        }
      })

      let severity: 'none' | 'warning' | 'danger' = 'none'
      let explanation = 'AC air preferences are aligned.'

      const hasConflict = overlappingBookings.some(b => {
        const p = profileMap.get(b.occupant_id)
        return p?.ac_preference && (
          (gProf.ac_preference === 'ac_cold' && p.ac_preference === 'fan_only') ||
          (gProf.ac_preference === 'fan_only' && p.ac_preference === 'ac_cold')
        )
      })

      if (hasConflict) {
        severity = 'danger'
        explanation = 'Opposing temperature styles (Cold AC vs Fan Only). May cause disputes over room temperature.'
      }

      analysis.push({
        label: 'AC & Air Style',
        guestVal: gProf.ac_preference.replace(/_/g, ' '),
        roommateVals: roommates,
        severity,
        explanation
      })
    }

    // Religion & Religiosity
    if (gProf.religion) {
      const roommates = overlappingBookings.map(b => {
        const p = profileMap.get(b.occupant_id)
        return {
          name: `${b.occupant?.first_name} ${b.occupant?.last_name}`,
          val: p?.religion 
            ? `${p.religion.toUpperCase()} (${p.religiosity_level ?? 'moderate'})`
            : 'Unspecified'
        }
      })

      let severity: 'none' | 'warning' | 'danger' = 'none'
      let explanation = 'Religious preferences are compatible.'

      const devoutMismatch = overlappingBookings.some(b => {
        const p = profileMap.get(b.occupant_id)
        return p?.religion && (
          (gProf.religiosity_level === 'devout' && p.religiosity_level === 'not_religious') ||
          (gProf.religiosity_level === 'not_religious' && p.religiosity_level === 'devout')
        )
      })

      if (devoutMismatch) {
        severity = 'warning'
        explanation = 'Difference in religiosity level (Devout vs Not Religious). Roommates should practice mutual respect.'
      }

      analysis.push({
        label: 'Religion & Lifestyle',
        guestVal: `${gProf.religion.toUpperCase()} (${gProf.religiosity_level ?? 'moderate'})`,
        roommateVals: roommates,
        severity,
        explanation
      })
    }

    // Relationship Status
    if (gProf.relationship_status) {
      const roommates = overlappingBookings.map(b => {
        const p = profileMap.get(b.occupant_id)
        return {
          name: `${b.occupant?.first_name} ${b.occupant?.last_name}`,
          val: p?.relationship_status ? p.relationship_status : 'Unspecified'
        }
      })

      analysis.push({
        label: 'Relationship Status',
        guestVal: gProf.relationship_status,
        roommateVals: roommates,
        severity: 'none',
        explanation: 'Status differences have no direct friction triggers.'
      })
    }

    return analysis
  }, [selectedBooking, selectedProfile, compareRoomId, sharedRooms, activeBookingsByRoom, profileMap])

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-6 overflow-hidden">
      
      {/* ── Top Header Bar ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Roommate Matching Workspace</h1>
            {matchingEnabled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-500 ring-1 ring-emerald-500/20">
                <Check className="h-3 w-3" /> Enabled
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500 ring-1 ring-amber-500/20">
                Disabled
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Assign incoming bookings to shared rooms based on compatibility scores, and resolve potential roommate friction.
          </p>
        </div>
      </div>

      {!matchingEnabled && (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="font-semibold text-text-primary">Roommate Matching is disabled</p>
              <p className="mt-0.5 text-sm text-text-secondary">
                To start matching roommates and collecting survey preferences on booking checkout, enable this feature in settings.
              </p>
            </div>
          </div>
          <a
            href="/settings?tab=branding"
            className="flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-600 transition-colors"
          >
            <Settings className="h-4 w-4" />
            Go to Settings
          </a>
        </div>
      )}

      {/* ── Workspace ──────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-6 overflow-hidden">
        
        {/* ── LEFT PANEL: Pending Bookings Queue ────────────────────── */}
        <div className="flex w-80 flex-col rounded-xl border border-border bg-surface overflow-hidden shrink-0">
          <div className="p-4 border-b border-border bg-surface-sunken">
            <h2 className="font-bold text-text-primary flex items-center gap-2">
              <Users className="h-4 w-4 text-brand" />
              Incoming Shared Bookings
            </h2>
            <p className="text-[11px] text-text-disabled mt-0.5">
              Select an occupant to evaluate and reassign.
            </p>
            
            <div className="relative mt-3">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-disabled" />
              <input
                type="search"
                placeholder="Search guest or ref..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-border bg-surface pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {pendingBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-text-disabled h-48">
                <User className="h-8 w-8 mb-2 stroke-[1.5]" />
                <p className="text-xs">No pending shared bookings found</p>
              </div>
            ) : (
              pendingBookings.map(b => {
                const isSelected = b.id === selectedBookingId
                const hasProfile = profileMap.has(b.occupant_id)
                const currentRoom = sharedRooms.find(r => r.id === b.room_id)

                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBookingId(isSelected ? null : b.id)}
                    className={`p-3.5 cursor-pointer text-left transition-colors relative ${
                      isSelected 
                        ? 'bg-brand/10 border-l-4 border-brand' 
                        : 'hover:bg-surface-raised'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <p className="font-semibold text-sm text-text-primary">
                        {b.occupant?.first_name} {b.occupant?.last_name}
                      </p>
                      {hasProfile ? (
                        <span className="inline-flex rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-500 ring-1 ring-emerald-500/20">
                          Surveyed
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-text-disabled/10 px-1.5 py-0.5 text-[9px] font-medium text-text-secondary">
                          No Survey
                        </span>
                      )}
                    </div>
                    
                    <p className="text-[11px] text-text-tertiary mt-0.5">
                      {b.booking_ref}
                    </p>
                    
                    <div className="mt-2.5 flex flex-col gap-1 text-[11px] text-text-secondary">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-text-tertiary" />
                        {new Date(b.check_in_date).toLocaleDateString('en-GH', { month: 'short', day: 'numeric' })} - {new Date(b.check_out_date).toLocaleDateString('en-GH', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </span>
                      {currentRoom && (
                        <span className="flex items-center gap-1.5 font-medium text-brand">
                          <Home className="h-3 w-3" />
                          Currently: Room {currentRoom.room_number}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: Shared Rooms Grid & Filters ──────────────── */}
        <div className="flex-1 flex flex-col rounded-xl border border-border bg-surface overflow-hidden">
          
          {/* Filters header */}
          <div className="p-4 border-b border-border bg-surface-sunken flex items-center justify-between gap-4 flex-wrap">
            <h2 className="font-bold text-text-primary flex items-center gap-2">
              <Home className="h-4 w-4 text-brand" />
              Shared Rooms Inventory
            </h2>
            
            <div className="flex gap-2.5">
              {/* Block filter */}
              <select
                value={blockFilter}
                onChange={e => setBlockFilter(e.target.value)}
                className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary focus:outline-none"
              >
                <option value="all">All Blocks</option>
                {blocks.map(b => (
                  <option key={b} value={b}>Block {b}</option>
                ))}
              </select>

              {/* Room type filter */}
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary focus:outline-none"
              >
                <option value="all">All Room Types</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Rooms Grid */}
          <div className="flex-1 overflow-y-auto p-4 bg-surface-sunken/40">
            {filteredRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-center text-text-disabled h-full">
                <Home className="h-10 w-10 mb-3 stroke-[1.5]" />
                <p className="font-medium text-text-primary">No shared rooms fit the filter criteria</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRooms.map(room => {
                  const cat = Array.isArray(room.category) ? room.category[0] : room.category
                  const capacity = cat?.capacity ?? 1
                  const roomBookings = activeBookingsByRoom.get(room.id) ?? []
                  
                  // Live status overlay details if a booking is selected on the left
                  const liveStats = selectedBooking ? roomCompatibilityScores.get(room.id) : null
                  
                  // Overlapping active roommates
                  const roommates = selectedBooking 
                    ? roomBookings.filter(b => b.id !== selectedBooking.id && doDatesOverlap(selectedBooking.check_in_date, selectedBooking.check_out_date, b.check_in_date, b.check_out_date))
                    : roomBookings

                  const occupCount = roommates.length
                  const isRoomFull = liveStats?.isFull ?? (occupCount >= capacity)
                  const score = liveStats?.score ?? 100

                  // Color mapping based on harmony score
                  const getScoreColors = (s: number) => {
                    if (s >= 80) return { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' }
                    if (s >= 60) return { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' }
                    return { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20' }
                  }

                  const scoreStyle = getScoreColors(score)

                  return (
                    <div
                      key={room.id}
                      className={`relative flex flex-col justify-between rounded-xl border bg-surface p-4 transition-all ${
                        selectedBooking && isRoomFull
                          ? 'opacity-60 border-border'
                          : selectedBooking && selectedBooking.room_id === room.id
                          ? 'border-brand ring-2 ring-brand/20 bg-brand/5 shadow-sm'
                          : selectedBooking
                          ? `hover:shadow-md cursor-pointer ${scoreStyle.border} border-2`
                          : 'border-border hover:shadow-sm'
                      }`}
                      onClick={() => {
                        if (selectedBooking && !isRoomFull && selectedBooking.room_id !== room.id) {
                          setTargetRoomId(room.id)
                          setIsConfirmingReassign(true)
                        }
                      }}
                    >
                      {/* Room Card Header */}
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h3 className="font-bold text-base text-text-primary">
                              Room {room.room_number}
                            </h3>
                            <p className="text-[11px] text-text-secondary font-medium">
                              {cat?.name} {room.block ? `· Block ${room.block}` : ''}
                            </p>
                          </div>

                          {/* Live Harmony Score Badge */}
                          {selectedBooking ? (
                            isRoomFull ? (
                              <span className="inline-flex rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-500 ring-1 ring-rose-500/20">
                                Full
                              </span>
                            ) : (
                              <div className={`flex flex-col items-center justify-center rounded-lg px-2.5 py-1 text-center font-bold shadow-sm ${scoreStyle.bg} ${scoreStyle.text}`}>
                                <span className="text-sm">{score}%</span>
                                <span className="text-[8px] uppercase tracking-wider font-semibold opacity-80">Harmony</span>
                              </div>
                            )
                          ) : (
                            <span className="text-xs font-semibold text-text-tertiary">
                              {occupCount} / {capacity} beds
                            </span>
                          )}
                        </div>

                        {/* Capacity gauge */}
                        <div className="w-full bg-surface-sunken rounded-full h-1.5 mt-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isRoomFull ? 'bg-rose-500' : occupCount > 0 ? 'bg-brand' : 'bg-text-disabled'
                            }`}
                            style={{ width: `${(occupCount / capacity) * 100}%` }}
                          />
                        </div>

                        {/* Room Occupants Details */}
                        <div className="mt-4 space-y-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                            {selectedBooking ? 'Overlapping Roommates' : 'Current Occupants'}
                          </p>
                          {roommates.length === 0 ? (
                            <p className="text-xs text-text-disabled italic py-1">No occupants scheduled during this period.</p>
                          ) : (
                            <div className="space-y-2">
                              {roommates.map(ocB => {
                                const oProf = profileMap.get(ocB.occupant_id)
                                return (
                                  <div key={ocB.id} className="text-xs flex flex-col rounded-lg bg-surface-sunken p-2 border border-border/50">
                                    <div className="flex justify-between items-center gap-1.5">
                                      <span className="font-semibold text-text-primary truncate">
                                        {ocB.occupant?.first_name} {ocB.occupant?.last_name}
                                      </span>
                                      <span className={`px-1 py-0.5 rounded text-[8px] font-medium uppercase ${
                                        ocB.status === 'checked_in' 
                                          ? 'bg-emerald-500/10 text-emerald-500' 
                                          : 'bg-amber-500/10 text-amber-500'
                                      }`}>
                                        {ocB.status.replace('_', ' ')}
                                      </span>
                                    </div>
                                    {oProf && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {oProf.sleep_schedule && (
                                          <span className="bg-surface px-1 py-0.5 rounded text-[9px] text-text-secondary ring-1 ring-border/50">
                                            {oProf.sleep_schedule === 'early_bird' ? '🌅 Early' : oProf.sleep_schedule === 'night_owl' ? '🦉 Night' : '🔄 Flex'}
                                          </span>
                                        )}
                                        {oProf.cleanliness && (
                                          <span className="bg-surface px-1 py-0.5 rounded text-[9px] text-text-secondary ring-1 ring-border/50">
                                            🧹 {oProf.cleanliness}/5
                                          </span>
                                        )}
                                        {oProf.religion && (
                                          <span className="bg-surface px-1 py-0.5 rounded text-[9px] text-text-secondary ring-1 ring-border/50 capitalize">
                                            🙏 {oProf.religion}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      {selectedBooking && (
                        <div className="mt-4 pt-3 border-t border-border flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setCompareRoomId(room.id)
                            }}
                            disabled={roommates.length === 0}
                            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-raised transition-colors disabled:opacity-50"
                          >
                            Compare
                          </button>
                          
                          {selectedBooking.room_id !== room.id && !isRoomFull && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setTargetRoomId(room.id)
                                setIsConfirmingReassign(true)
                              }}
                              className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
                            >
                              Assign
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── COMPARISON PANEL DIALOG ─────────────────────────────────── */}
      {compareRoomId && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-xl border border-border bg-surface text-left shadow-2xl flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-border bg-surface-sunken flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg text-text-primary">
                  Roommate Comparison & Friction Analysis
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Comparing <span className="font-semibold text-brand">{selectedBooking.occupant?.first_name} {selectedBooking.occupant?.last_name}</span> against Room {sharedRooms.find(r => r.id === compareRoomId)?.room_number} roommates.
                </p>
              </div>
              <button 
                onClick={() => setCompareRoomId(null)}
                className="rounded-md p-1.5 hover:bg-surface-raised text-text-tertiary transition-colors"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body / Table comparison */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* Overall Harmony summary */}
              <div className="flex items-center gap-4 rounded-lg bg-surface-sunken p-4 border border-border">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 font-bold text-lg ring-1 ring-emerald-500/20">
                  {roomCompatibilityScores.get(compareRoomId)?.score}%
                </div>
                <div>
                  <p className="font-bold text-sm text-text-primary">Overall Compatibility Harmony Score</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    This score is the average compatibility across all lifestyle survey categories. Higher scores indicate lower lifestyle friction.
                  </p>
                </div>
              </div>

              {/* Side-by-side Table */}
              <div className="overflow-hidden rounded-lg border border-border bg-surface">
                <div className="divide-y divide-border">
                  
                  {/* Grid header */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3 bg-surface-sunken font-bold text-xs text-text-tertiary uppercase tracking-wider">
                    <span className="md:col-span-1">Survey Preference</span>
                    <span className="md:col-span-1 text-brand">New Guest</span>
                    <span className="md:col-span-1">Roommates</span>
                    <span className="md:col-span-1">Compatibility / Friction</span>
                  </div>

                  {/* Comparisons */}
                  {frictionAnalysis.map((item, idx) => {
                    const statusIcons = {
                      none: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />,
                      warning: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
                      danger: <XCircle className="h-4 w-4 text-rose-500 shrink-0" />,
                    }

                    const statusBg = {
                      none: 'bg-emerald-500/5',
                      warning: 'bg-amber-500/5',
                      danger: 'bg-rose-500/5',
                    }

                    return (
                      <div key={idx} className={`grid grid-cols-1 md:grid-cols-4 gap-4 p-3.5 items-start text-xs ${statusBg[item.severity]}`}>
                        <span className="font-semibold text-text-primary text-[11px]">{item.label}</span>
                        
                        {/* New Guest column */}
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-text-secondary capitalize">{item.guestVal}</span>
                          <span className="text-[10px] text-text-tertiary">Applicant</span>
                        </div>

                        {/* Roommates column */}
                        <div className="space-y-2">
                          {item.roommateVals.map((rm, rIdx) => (
                            <div key={rIdx} className="flex flex-col">
                              <span className="font-medium text-text-secondary capitalize">{rm.val}</span>
                              <span className="text-[10px] text-text-tertiary truncate">{rm.name}</span>
                            </div>
                          ))}
                        </div>

                        {/* Friction explanation column */}
                        <div className="flex gap-2 items-start md:col-span-1">
                          {statusIcons[item.severity]}
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-text-secondary leading-tight">{item.explanation}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-surface-sunken flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCompareRoomId(null)}
                className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-raised transition-colors"
              >
                Close
              </button>
              
              {selectedBooking.room_id !== compareRoomId && (
                <button
                  type="button"
                  onClick={() => {
                    setTargetRoomId(compareRoomId)
                    setIsConfirmingReassign(true)
                  }}
                  className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
                >
                  Confirm Room Assignment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRMATION MODAL ─────────────────────────────────────── */}
      {isConfirmingReassign && selectedBooking && targetRoomId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 text-left shadow-2xl space-y-4">
            
            <div className="flex items-start gap-3">
              <RefreshCw className="h-5 w-5 text-brand shrink-0 animate-spin-slow" />
              <div>
                <h3 className="font-bold text-base text-text-primary">
                  Confirm Occupant Reassignment
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  You are reassigning <span className="font-semibold text-text-primary">{selectedBooking.occupant?.first_name} {selectedBooking.occupant?.last_name}</span> to <strong>Room {rooms.find(r => r.id === targetRoomId)?.room_number}</strong>.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reason" className="text-xs font-medium text-text-secondary">
                Reason for reassignment (optional)
              </label>
              <textarea
                id="reason"
                rows={3}
                placeholder="e.g. Requested roommate change, better lifestyle compatibility match."
                value={reassignReason}
                onChange={e => setReassignReason(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-colors"
              />
            </div>

            {errorMsg && (
              <div className="rounded-md bg-rose-500/10 p-2.5 text-xs text-rose-500 flex items-center gap-1.5">
                <Info className="h-4 w-4" />
                {errorMsg}
              </div>
            )}

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsConfirmingReassign(false)
                  setReassignReason('')
                  setErrorMsg(null)
                }}
                disabled={isPending}
                className="rounded-md border border-border px-3.5 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-raised transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={executeReassignment}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-xs font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Confirm Reassign
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
