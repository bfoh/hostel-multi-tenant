-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 097 — Format money to 2 decimal places in audit_log descriptions
--
-- Before: 'Payment of GHS 6500.0000000000000000 recorded via card'
-- After:  'Payment of GHS 6500.00 recorded via card'
--
-- Two parts:
--   1. Replace trg_audit_payment so future rows use the formatted string.
--   2. Backfill existing payment.recorded rows from new_values.amount
--      (idempotent — reconstructed from the raw pesewas amount).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Replace the trigger function ─────────────────────────────────────────

create or replace function trg_audit_payment()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    insert into audit_log (tenant_id, action, entity_type, entity_id, description, new_values)
    values (
      new.tenant_id,
      'payment.recorded',
      'booking_payment',
      new.id,
      'Payment of GHS '
        || to_char(new.amount::numeric / 100, 'FM999999990.00')
        || ' recorded via '
        || new.method,
      jsonb_build_object('amount', new.amount, 'method', new.method, 'status', new.status)
    );
  elsif tg_op = 'UPDATE' and old.status <> new.status then
    insert into audit_log (tenant_id, action, entity_type, entity_id, description, old_values, new_values)
    values (
      new.tenant_id,
      'payment.status_changed',
      'booking_payment',
      new.id,
      'Payment status changed from ' || old.status || ' to ' || new.status,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
  end if;
  return coalesce(new, old);
end;
$$;

-- ── 2. Backfill existing payment.recorded rows ──────────────────────────────
-- We rebuild the description from new_values rather than regex-parsing the old
-- text — cleaner and idempotent. RLS has no UPDATE policy on audit_log, but
-- migrations run as the service role and bypass RLS.

update audit_log
set description =
  'Payment of GHS '
  || to_char((new_values->>'amount')::numeric / 100, 'FM999999990.00')
  || ' recorded via '
  || (new_values->>'method')
where action = 'payment.recorded'
  and new_values ? 'amount'
  and new_values ? 'method';
