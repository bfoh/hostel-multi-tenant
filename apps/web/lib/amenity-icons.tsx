import {
  Wifi, Wind, Droplets, Shield, Car, Utensils, Zap, Camera,
  BookOpen, Archive, Dumbbell, Bath, WashingMachine, Sun, Check,
  type LucideIcon,
} from 'lucide-react'

const RULES: Array<{ match: RegExp; icon: LucideIcon }> = [
  { match: /wifi|internet/i, icon: Wifi },
  { match: /air.?condition|fan/i, icon: Wind },
  { match: /water heater|hot water/i, icon: Droplets },
  { match: /security|cctv|guard/i, icon: Shield },
  { match: /camera/i, icon: Camera },
  { match: /parking|car/i, icon: Car },
  { match: /kitchen/i, icon: Utensils },
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
