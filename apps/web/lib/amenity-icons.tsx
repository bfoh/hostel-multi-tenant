import {
  Wifi, Wind, Droplets, Shield, Car, Utensils, Zap, Camera,
  BookOpen, Archive, Dumbbell, Bath, WashingMachine, Sun, Check,
  type LucideIcon,
} from 'lucide-react'

const RULES: Array<{ match: RegExp; icon: LucideIcon }> = [
  { match: /wifi|internet/i, icon: Wifi },
  { match: /air.?condition|fan|^ac$/i, icon: Wind },
  { match: /water/i, icon: Droplets },
  { match: /security|cctv|guard/i, icon: Shield },
  { match: /camera/i, icon: Camera },
  { match: /parking|car/i, icon: Car },
  { match: /kitchen|canteen/i, icon: Utensils },
  { match: /generator|backup power|electricity/i, icon: Zap },
  { match: /study|desk/i, icon: BookOpen },
  { match: /wardrobe|storage/i, icon: Archive },
  { match: /gym|football|sports|pitch/i, icon: Dumbbell },
  { match: /bathroom|shower/i, icon: Bath },
  { match: /laundry|washing/i, icon: WashingMachine },
  { match: /balcony|outdoor/i, icon: Sun },
]

/** Best-effort icon match for a free-text amenity string; falls back to a checkmark. */
export function amenityIcon(label: string): LucideIcon {
  return RULES.find((r) => r.match.test(label))?.icon ?? Check
}

/** Labels for the short keys older listings and onboarding stored
 *  ('wifi', 'ac', …); the room form saves readable labels already. */
const SHORT_LABELS: Record<string, string> = {
  wifi: 'Wi-Fi',
  ac: 'Air conditioning',
  water: 'Running water',
  electricity: 'Electricity',
  security: 'Security',
  parking: 'Parking',
  canteen: 'Canteen',
  gym: 'Gym',
  laundry: 'Laundry',
  kitchen: 'Kitchen access',
}

/** Display label for an amenity string: known short keys are expanded,
 *  anything else is shown as entered (underscores read as spaces) with its
 *  first letter capitalised. */
export function amenityLabel(amenity: string): string {
  const trimmed = amenity.trim().replace(/_+/g, ' ')
  const known = SHORT_LABELS[trimmed.toLowerCase()]
  if (known) return known
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}
