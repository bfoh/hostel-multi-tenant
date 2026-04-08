/**
 * Auto-generated Supabase database types placeholder.
 *
 * Run `npx supabase gen types typescript --local > packages/types/src/database.generated.ts`
 * after applying migrations, then import from there instead.
 *
 * For now we export a minimal Database type so the Supabase client compiles.
 */
export type Database = {
  public: {
    Tables: Record<string, {
      Row: Record<string, unknown>
      Insert: Record<string, unknown>
      Update: Record<string, unknown>
    }>
    Views: Record<string, { Row: Record<string, unknown> }>
    Functions: Record<string, unknown>
    Enums: Record<string, unknown>
  }
}
