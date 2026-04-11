import { createClient } from '@supabase/supabase-js'

import type { Database } from '@gh-hostels/types'

/**
 * Admin Supabase client using the service role key.
 * ONLY use in:
 *  - Server Actions that need to bypass RLS (e.g. platform-level tenant provisioning)
 *  - Trigger.dev background jobs
 *  - Supabase Edge Functions
 *
 * NEVER expose this client or the SERVICE_ROLE_KEY to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
        'Admin client cannot be initialised.'
    )
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
