import { createServerClient } from '@supabase/ssr'
import { type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

import type { Database } from '@abrempong/types'

/**
 * Server-side Supabase client.
 * Use in Server Components, Server Actions, and Route Handlers.
 * Reads/writes cookies so auth state persists across requests.
 *
 * Note: We cast to SupabaseClient<Database> explicitly because @supabase/ssr@0.10.x
 * has a type inference regression with @supabase/supabase-js >=2.100 where the
 * Schema type parameter resolves to `never`. The runtime client is correct;
 * only the TypeScript inference is broken. The cast restores proper typing.
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: Parameters<typeof cookieStore.set>[2] }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — cookie mutation is a no-op.
            // The middleware handles session refresh.
          }
        },
      },
    },
  )

  return client as unknown as SupabaseClient<Database>
}
