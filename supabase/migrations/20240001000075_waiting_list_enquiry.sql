-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 075 — Public website enquiries via waiting_list
--
-- Extends waiting_list to capture enquiries submitted from a tenant's
-- public-facing marketing site (e.g. www.abremponghostel.com). The source
-- column lets the dashboard distinguish staff-entered walk-ins from inbound
-- web leads; the message column carries the free-text body from the form.
--
-- Inserts from the public route use service_role and bypass RLS; existing
-- tenant_members RLS continues to govern dashboard reads/updates.
-- ═══════════════════════════════════════════════════════════════════════════

alter table waiting_list
  add column if not exists source  text not null default 'manual',
  add column if not exists message text;

alter table waiting_list
  drop constraint if exists waiting_list_source_check;

alter table waiting_list
  add constraint waiting_list_source_check
  check (source in ('manual','website','whatsapp','referral'));

create index if not exists waiting_list_tenant_source_status_idx
  on waiting_list (tenant_id, source, status);
