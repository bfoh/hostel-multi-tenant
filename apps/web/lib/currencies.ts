/**
 * Client-safe currency constants. Kept separate from lib/data/fx so client
 * components can import the seed list without dragging in next/headers via
 * the admin Supabase client.
 */
export const COMMON_FOREIGN_CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'XOF', 'ZAR', 'CFA'] as const

export type CommonForeignCurrency = typeof COMMON_FOREIGN_CURRENCIES[number]
