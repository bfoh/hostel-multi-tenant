/**
 * Server-side pricing for walk-in flows.
 *
 * The client form sends raw inputs (weight, duration, court selection,
 * etc.); the server recomputes the final amount from the revenue point's
 * `public_config`. Never trust an amount supplied by the client.
 */

export type RevenuePointType =
  | 'gym'
  | 'sports'
  | 'laundry'
  | 'cafeteria'
  | 'restaurant'
  | 'mini_mart'
  | 'parking'
  | 'printing'
  | 'other'

export interface GymConfig {
  day_pass_price: number              // pesewas
  includes?: string[]
}

export interface SportsCourt {
  id:           string
  name:         string
  hourly_rate:  number                // pesewas
}

export interface SportsConfig {
  courts:       SportsCourt[]
  min_minutes:  number                // typically 60
}

export interface LaundryConfig {
  rate_per_kg:       number           // pesewas
  min_charge:        number           // pesewas
  turnaround_hours:  number
}

export interface RestaurantConfig {
  tables:           string[]
  pickup_allowed:   boolean
}

export type PublicConfig =
  | ({ kind: 'gym' } & GymConfig)
  | ({ kind: 'sports' } & SportsConfig)
  | ({ kind: 'laundry' } & LaundryConfig)
  | ({ kind: 'restaurant' } & RestaurantConfig)

/** Raw `public_config` JSON keyed by type. */
export function readPublicConfig(
  type: RevenuePointType,
  raw: unknown,
): PublicConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  switch (type) {
    case 'gym':
      if (typeof r.day_pass_price !== 'number') return null
      return {
        kind:           'gym',
        day_pass_price: r.day_pass_price,
        includes:       Array.isArray(r.includes) ? r.includes as string[] : [],
      }

    case 'sports':
      if (!Array.isArray(r.courts)) return null
      return {
        kind:        'sports',
        courts:      r.courts as SportsCourt[],
        min_minutes: typeof r.min_minutes === 'number' ? r.min_minutes : 60,
      }

    case 'laundry':
      if (typeof r.rate_per_kg !== 'number') return null
      return {
        kind:             'laundry',
        rate_per_kg:      r.rate_per_kg,
        min_charge:       typeof r.min_charge === 'number' ? r.min_charge : 0,
        turnaround_hours: typeof r.turnaround_hours === 'number' ? r.turnaround_hours : 24,
      }

    case 'cafeteria':
    case 'restaurant':
      return {
        kind:           'restaurant',
        tables:         Array.isArray(r.tables) ? r.tables as string[] : [],
        pickup_allowed: r.pickup_allowed !== false,
      }

    default:
      return null
  }
}

/* ── Per-flow input shapes ─────────────────────────────────────────────── */

export interface GymInput {
  // Day pass: no inputs beyond visitor identity.
}

export interface SportsInput {
  court_id:        string
  duration_minutes: number
}

export interface LaundryInput {
  weight_kg: number
}

export interface PriceResult {
  amount:           number    // pesewas
  description:      string
  duration_minutes?: number
  weight_kg?:       number
  court_id?:        string
  court_name?:      string
}

/**
 * Compute the chargeable amount + a human-readable description for a
 * walk-in sale. Returns null when the input is invalid for the type.
 */
export function priceWalkinSale(
  cfg:   PublicConfig,
  input: unknown,
): PriceResult | null {
  switch (cfg.kind) {
    case 'gym':
      if (cfg.day_pass_price <= 0) return null
      return {
        amount:           cfg.day_pass_price,
        description:      'Gym day pass',
        duration_minutes: 24 * 60,
      }

    case 'sports': {
      const i = input as SportsInput
      if (!i?.court_id || !Number.isFinite(i?.duration_minutes)) return null
      const court = cfg.courts.find((c) => c.id === i.court_id)
      if (!court) return null
      const minutes = Math.max(cfg.min_minutes, Math.round(i.duration_minutes))
      // Hourly rate, billed by the half-hour
      const halfHours = Math.ceil(minutes / 30)
      const amount    = Math.round((court.hourly_rate / 2) * halfHours)
      if (amount <= 0) return null
      return {
        amount,
        description:      `${court.name} · ${minutes} min`,
        duration_minutes: minutes,
        court_id:         court.id,
        court_name:       court.name,
      }
    }

    case 'laundry': {
      const i = input as LaundryInput
      if (!Number.isFinite(i?.weight_kg) || i.weight_kg <= 0) return null
      const raw    = Math.round(cfg.rate_per_kg * i.weight_kg)
      const amount = Math.max(raw, cfg.min_charge)
      if (amount <= 0) return null
      return {
        amount,
        description: `Laundry · ${i.weight_kg.toFixed(2)} kg`,
        weight_kg:   i.weight_kg,
      }
    }

    case 'restaurant':
      // Restaurant uses food_orders, not this helper.
      return null
  }
}

/* ── Entry token ──────────────────────────────────────────────────────── */

/**
 * Generate a 6-character entry/pickup token. Uses a Crockford-style
 * alphabet (no 0/O, no 1/I/L) for human-readability when shouted across
 * a noisy gym counter.
 */
export function generateEntryToken(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

/* ── Status helpers ───────────────────────────────────────────────────── */

/**
 * Initial status when the sale is created via the webhook on charge.success.
 * Laundry needs operational tracking; everything else is closed immediately.
 */
export function initialSaleStatus(type: RevenuePointType): string {
  return type === 'laundry' ? 'received' : 'completed'
}
