// ── Tenant / Organisation ─────────────────────────────────────────────────────

export type SubscriptionPlan = 'starter' | 'growth' | 'pro' | 'enterprise'

export type TenantStatus = 'active' | 'suspended' | 'trial' | 'cancelled'

export interface Tenant {
  id: string
  slug: string
  name: string
  customDomain: string | null
  plan: SubscriptionPlan
  status: TenantStatus
  trialEndsAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TenantBranding {
  tenantId: string
  primaryColor: string | null     // HSL components e.g. "207 58% 28%"
  accentColor: string | null
  logoUrl: string | null
  faviconUrl: string | null
  fontDisplay: string | null
  fontBody: string | null
}

export interface TenantConfig {
  tenantId: string
  currency: string                // ISO 4217 — default "GHS"
  timezone: string                // IANA timezone — default "Africa/Accra"
  country: string                 // ISO 3166-1 alpha-2 — default "GH"
  smsEnabled: boolean
  emailEnabled: boolean
  whatsappEnabled: boolean
  momoEnabled: boolean
  cardEnabled: boolean
  voiceAiEnabled: boolean
  widgetEnabled: boolean
  widgetApiKey: string | null
  aiPersonaName: string | null
  aiPersonaVoice: string | null
  semesterSystem: boolean         // Ghana universities use semesters
  autoCheckoutEnabled: boolean
  lateCheckoutFeePercent: number  // 0 = disabled
}
