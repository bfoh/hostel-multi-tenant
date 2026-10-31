-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 151 — Service role only for booking_otps
--
-- booking_otps (booking verification codes sent by SMS from the AI chat,
-- with the guest's phone number) was created outside the migrations, without
-- RLS, and Supabase's default grants let the anon and authenticated roles
-- read and write it: anyone with the public anon key could read live codes
-- or plant their own. Its only reader and writer is app/api/ai/chat, which
-- uses the service-role client.
--
-- Guarded so a fresh database built from these migrations, where the table
-- does not exist, still replays cleanly.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.booking_otps') is not null then
    alter table public.booking_otps enable row level security;
    revoke all on public.booking_otps from public, anon, authenticated;
    grant all on public.booking_otps to service_role;
  end if;
end $$;
