import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@abrempong/types'

/**
 * Browser-side Supabase client.
 * Use in Client Components (any file with 'use client').
 * Creates a new client per call — intentional, SSR caches it internally.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
