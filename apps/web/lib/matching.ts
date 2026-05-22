export interface OccupantMatchingProfile {
  id?: string
  tenant_id?: string
  occupant_id?: string
  cleanliness: number | null
  sleep_schedule: 'early_bird' | 'night_owl' | 'flexible' | null
  study_preference: 'in_room_quiet' | 'in_room_background_noise' | 'library' | null
  guest_frequency: 'none' | 'rare' | 'frequent' | null
  noise_tolerance: number | null
  ac_preference: 'ac_cold' | 'fan_only' | 'no_preference' | null
  hobbies: string[] | null
  religion: 'christian' | 'muslim' | 'traditional' | 'other' | 'none' | 'prefer_not_to_say' | null
  religiosity_level: 'devout' | 'moderate' | 'not_religious' | null
  relationship_status: 'single' | 'in_relationship' | 'married' | null
}

/**
 * Calculates a compatibility score between 0 and 100 between two matching profiles.
 * If one or both profiles are completely empty, returns 100 (neutral/compatible).
 * Missing fields are ignored, and the weights are normalized dynamically.
 */
export function calculateCompatibility(
  a: Partial<OccupantMatchingProfile> | null,
  b: Partial<OccupantMatchingProfile> | null
): number {
  if (!a || !b) return 100

  let totalScore = 0
  let totalWeight = 0

  const addScore = (score: number, weight: number) => {
    totalScore += score * weight
    totalWeight += weight
  }

  // 1. Cleanliness (weight = 15)
  if (typeof a.cleanliness === 'number' && typeof b.cleanliness === 'number') {
    const score = 1 - Math.abs(a.cleanliness - b.cleanliness) / 4
    addScore(score, 15)
  }

  // 2. Sleep Schedule (weight = 15)
  if (a.sleep_schedule && b.sleep_schedule) {
    let score = 0.8
    if (a.sleep_schedule === b.sleep_schedule) {
      score = 1.0
    } else if (
      (a.sleep_schedule === 'early_bird' && b.sleep_schedule === 'night_owl') ||
      (a.sleep_schedule === 'night_owl' && b.sleep_schedule === 'early_bird')
    ) {
      score = 0.2
    }
    addScore(score, 15)
  }

  // 3. Study Preference (weight = 10)
  if (a.study_preference && b.study_preference) {
    let score = 0.5
    if (a.study_preference === b.study_preference) {
      score = 1.0
    } else if (a.study_preference === 'library' || b.study_preference === 'library') {
      score = 0.8
    }
    addScore(score, 10)
  }

  // 4. Guest Frequency (weight = 10)
  if (a.guest_frequency && b.guest_frequency) {
    let score = 0.5
    if (a.guest_frequency === b.guest_frequency) {
      score = 1.0
    } else if (
      (a.guest_frequency === 'none' && b.guest_frequency === 'rare') ||
      (a.guest_frequency === 'rare' && b.guest_frequency === 'none')
    ) {
      score = 0.7
    } else if (
      (a.guest_frequency === 'none' && b.guest_frequency === 'frequent') ||
      (a.guest_frequency === 'frequent' && b.guest_frequency === 'none')
    ) {
      score = 0.2
    } else if (
      (a.guest_frequency === 'rare' && b.guest_frequency === 'frequent') ||
      (a.guest_frequency === 'frequent' && b.guest_frequency === 'rare')
    ) {
      score = 0.6
    }
    addScore(score, 10)
  }

  // 5. Noise Tolerance (weight = 10)
  if (typeof a.noise_tolerance === 'number' && typeof b.noise_tolerance === 'number') {
    const score = 1 - Math.abs(a.noise_tolerance - b.noise_tolerance) / 4
    addScore(score, 10)
  }

  // 6. AC Preference (weight = 10)
  if (a.ac_preference && b.ac_preference) {
    let score = 0.2
    if (a.ac_preference === b.ac_preference) {
      score = 1.0
    } else if (a.ac_preference === 'no_preference' || b.ac_preference === 'no_preference') {
      score = 0.8
    }
    addScore(score, 10)
  }

  // 7. Hobbies (weight = 10)
  if (Array.isArray(a.hobbies) && Array.isArray(b.hobbies) && a.hobbies.length > 0 && b.hobbies.length > 0) {
    const setA = new Set(a.hobbies.map(h => h.toLowerCase().trim()))
    const setB = new Set(b.hobbies.map(h => h.toLowerCase().trim()))
    const intersection = new Set([...setA].filter(x => setB.has(x)))
    const union = new Set([...setA, ...setB])
    const jaccard = union.size === 0 ? 1.0 : intersection.size / union.size
    addScore(jaccard, 10)
  }

  // 8. Religion (weight = 10)
  if (a.religion && b.religion) {
    let score = 0.5
    if (a.religion === b.religion) {
      score = 1.0
    } else if (
      a.religion === 'none' ||
      b.religion === 'none' ||
      a.religion === 'prefer_not_to_say' ||
      b.religion === 'prefer_not_to_say' ||
      a.religion === 'other' ||
      b.religion === 'other'
    ) {
      score = 0.8
    }
    addScore(score, 10)
  }

  // 9. Religiosity Level (weight = 5)
  if (a.religiosity_level && b.religiosity_level) {
    let score = 0.7
    if (a.religiosity_level === b.religiosity_level) {
      score = 1.0
    } else if (
      (a.religiosity_level === 'devout' && b.religiosity_level === 'not_religious') ||
      (a.religiosity_level === 'not_religious' && b.religiosity_level === 'devout')
    ) {
      score = 0.3
    }
    addScore(score, 5)
  }

  // 10. Relationship Status (weight = 5)
  if (a.relationship_status && b.relationship_status) {
    let score = 0.8
    if (a.relationship_status === b.relationship_status) {
      score = 1.0
    } else if (
      (a.relationship_status === 'married' && b.relationship_status === 'single') ||
      (a.relationship_status === 'single' && b.relationship_status === 'married')
    ) {
      score = 0.6
    }
    addScore(score, 5)
  }

  if (totalWeight === 0) return 100

  return Math.round((totalScore / totalWeight) * 100)
}

/**
 * Calculates the average compatibility score between a target occupant profile
 * and all current occupants in a room who have active profiles.
 * If the room is empty, returns 100.
 */
export function calculateRoomHarmonyScore(
  targetProfile: Partial<OccupantMatchingProfile> | null,
  currentProfiles: (Partial<OccupantMatchingProfile> | null)[]
): number {
  const activeProfiles = currentProfiles.filter(Boolean)
  if (activeProfiles.length === 0) return 100

  let sum = 0
  for (const profile of activeProfiles) {
    sum += calculateCompatibility(targetProfile, profile)
  }

  return Math.round(sum / activeProfiles.length)
}
