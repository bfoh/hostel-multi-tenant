# Student Portal — Payments & Bank-Draft Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bank-draft submission to the student portal end-to-end (upload, owner/accountant verification queue, real-time alerts, tenant settings for deposit account details), without touching the existing Paystack online-payment flow.

**Architecture:** Bank drafts ride on the existing `booking_payments` table via `status='pending'` + new `method='bank_draft'`. A new private storage bucket holds the file. Tenant settings get a new "Bank Deposit Details" block. Owner/accountant get a new `/payments/drafts` page with Supabase realtime, web push, and SMS notifications driven by the existing infrastructure.

**Tech Stack:** Next.js 16 App Router · Supabase Postgres + Storage + Auth + Realtime · Tailwind CSS · TypeScript · Zod · web-push · Arkesel SMS · react-hook-form

**Spec:** `docs/superpowers/specs/2026-05-05-student-portal-payments-bank-draft-design.md`

**Testing approach:** This codebase has no automated test framework today (every existing route relies on manual UAT documented in `TESTING.md`). Each task uses `pnpm --filter @gh-hostels/web type-check` + an explicit manual smoke test. The final task adds a comprehensive bank-draft section to TESTING.md.

**Conventions worth knowing before you start:**
- All money is stored in **pesewas** (1 GHS = 100 pesewas). Never store decimal cedis.
- Tenant context comes from `getServerTenantId()` (header → cookie fallback). Occupant context comes from `getOccupantSession()`.
- Service-role writes use `createAdminClient()`. Cookie-bound user reads use `await createClient()`.
- `payment_method` is a real Postgres enum — adding values needs `alter type ... add value`.
- Notifications go via `lib/push.ts` (`sendPushToTenant`) and `lib/sms.ts` (typed helpers).
- Existing `sync_booking_paid_amount` trigger re-aggregates `bookings.paid_amount` from `booking_payments` rows where `status='success'`. We do not need to update `paid_amount` ourselves.

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `supabase/migrations/20240001000055_bank_draft_submissions.sql` | Enum value, columns, partial unique index, RLS, tenant bank columns |
| `supabase/migrations/20240001000056_bank_drafts_storage_bucket.sql` | Private bucket + storage RLS |
| `apps/web/lib/auth/tenant-role.ts` | `requireTenantRole(['owner', 'accountant'])` helper |
| `apps/web/lib/bank-draft.ts` | File validation, signed-URL builder, notification dispatch |
| `apps/web/lib/sms.ts` (modify) | Three new typed SMS helpers |
| `apps/web/app/api/occupant/bank-draft/route.ts` | POST: upload draft (multipart) |
| `apps/web/app/api/occupant/bank-draft/[id]/route.ts` | DELETE: occupant cancels their own pending draft |
| `apps/web/app/api/bank-drafts/[id]/approve/route.ts` | POST: owner/accountant approves |
| `apps/web/app/api/bank-drafts/[id]/reject/route.ts` | POST: owner/accountant rejects with reason |
| `apps/web/app/api/bank-drafts/[id]/undo/route.ts` | POST: owner/accountant reverses approval within 5 min |
| `apps/web/app/(tenant)/payments/drafts/page.tsx` | Server-rendered admin queue page |
| `apps/web/components/payments/draft-queue.tsx` | Client: queue table + realtime subscription |
| `apps/web/components/payments/draft-review-panel.tsx` | Client: slide-over review panel (Undo countdown lives inline in `draft-queue.tsx`) |
| `apps/web/components/occupant-portal/bank-deposit-section.tsx` | Client: collapsible picker + bank details + form |
| `apps/web/components/occupant-portal/draft-upload-form.tsx` | Client: multipart upload form |
| `apps/web/components/occupant-portal/pending-draft-card.tsx` | Client: pending state card with View/Cancel |
| `apps/web/components/settings/bank-deposit-form.tsx` | Client: tenant settings form |
| `apps/web/components/payments/sidebar-draft-badge.tsx` | Client: realtime pending count badge for the admin sidebar |

**Modified files:**

| Path | Change |
|---|---|
| `apps/web/app/(occupant-portal)/occupant-portal/payments/page.tsx` | Render `BankDepositSection` below existing balance card; update history pills |
| `apps/web/app/(tenant)/settings/page.tsx` | Add `BankDepositForm` block + missing-bank-details banner |
| `apps/web/app/api/settings/branding/route.ts` | Extend zod schema + update DB to accept the new bank fields |
| `apps/web/components/admin-sidebar.tsx` (or its actual filename) | Inject draft-count badge into the Payments → Bank drafts entry |
| `TESTING.md` | New phase: bank-draft UAT |
| `APP_OVERVIEW.md` | Brief mention under "Payments" |

---

## Phase 0 — Branch & sanity check

### Task 0: Set up the feature branch

**Files:** none (git only)

- [ ] **Step 1: Confirm clean working tree (or stash unrelated work)**

Run: `git status --short`

Expected: only the unrelated changes already in your tree at the time of the spec commit (`5f0ecb9`). If the tree is dirty with new unrelated work, stash it first: `git stash push -u -m "pre-bank-draft work"`.

- [ ] **Step 2: Create the feature branch**

Run:
```bash
git checkout -b feat/bank-draft-payments
```

Expected: `Switched to a new branch 'feat/bank-draft-payments'`.

- [ ] **Step 3: Verify dev environment runs**

Run:
```bash
cd apps/web && pnpm install && pnpm type-check
```

Expected: install completes without errors, `tsc --noEmit` exits 0. If there are pre-existing type errors unrelated to this work, note them and continue — do not fix them as part of this plan.

- [ ] **Step 4: Verify Supabase CLI is available + project is linked**

Run:
```bash
supabase --version
supabase status
```

Expected: CLI version printed, status shows the linked project. If not linked, follow `TESTING.md` § "Apply all database migrations" before proceeding.

---

## Phase 1 — Database & Storage

### Task 1: Migration 055 — Schema changes

**Files:**
- Create: `supabase/migrations/20240001000055_bank_draft_submissions.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20240001000055_bank_draft_submissions.sql` with exactly this content:

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 055 — Bank Draft Submissions
-- Adds 'bank_draft' as a payment method, draft-specific columns on
-- booking_payments, a partial unique index enforcing one in-flight draft
-- per booking, and tenant-level bank deposit account fields.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Allow 'bank_draft' as a payment method on booking_payments.method
alter type payment_method add value if not exists 'bank_draft';

-- 2. Draft-specific columns on booking_payments. All nullable; only used
--    when method='bank_draft'.
alter table booking_payments
  add column if not exists draft_file_path     text,
  add column if not exists draft_bank_name     text,
  add column if not exists draft_number        text,
  add column if not exists draft_deposit_date  date,
  add column if not exists draft_note          text
    check (draft_note is null or char_length(draft_note) <= 140),
  add column if not exists rejected_reason     text
    check (rejected_reason is null or char_length(rejected_reason) <= 500),
  add column if not exists rejected_by         uuid references auth.users(id),
  add column if not exists rejected_at         timestamptz,
  add column if not exists approved_by         uuid references auth.users(id),
  add column if not exists approved_at         timestamptz;

-- 3. DB-level guarantee: one pending bank-draft per booking at a time.
create unique index if not exists booking_payments_one_pending_draft
  on booking_payments (booking_id)
  where status = 'pending' and method = 'bank_draft';

-- 4. Tenant bank deposit details.
alter table tenants
  add column if not exists bank_name             text,
  add column if not exists bank_branch           text,
  add column if not exists bank_account_name     text,
  add column if not exists bank_account_number   text,
  add column if not exists bank_swift_code       text,
  add column if not exists bank_instructions     text
    check (bank_instructions is null or char_length(bank_instructions) <= 280),
  add column if not exists bank_deposits_enabled boolean not null default false;

-- 5. RLS additions for booking_payments.
--    Existing policies already restrict by tenant. Add:
--      - occupants can INSERT pending bank-draft rows on their own bookings
--      - occupants can DELETE their own pending bank-draft rows (cancel)
--      - owner/accountant can UPDATE status, approval, and rejection fields

-- (Booking_payments already has RLS enabled in migration 001; we just add policies.)

create policy "occupant inserts own pending bank draft"
  on booking_payments for insert
  to authenticated
  with check (
    method = 'bank_draft'
    and status = 'pending'
    and exists (
      select 1
        from bookings b
        join occupants o on o.id = b.occupant_id
       where b.id = booking_payments.booking_id
         and b.tenant_id = booking_payments.tenant_id
         and o.user_id = auth.uid()
    )
  );

create policy "occupant cancels own pending bank draft"
  on booking_payments for delete
  to authenticated
  using (
    method = 'bank_draft'
    and status = 'pending'
    and exists (
      select 1
        from bookings b
        join occupants o on o.id = b.occupant_id
       where b.id = booking_payments.booking_id
         and o.user_id = auth.uid()
    )
  );

create policy "owner or accountant approves or rejects bank draft"
  on booking_payments for update
  to authenticated
  using (
    method = 'bank_draft'
    and tenant_id in (
      select tm.tenant_id
        from tenant_members tm
       where tm.user_id = auth.uid()
         and tm.is_active
         and tm.role in ('owner', 'accountant')
    )
  )
  with check (
    method = 'bank_draft'
    and tenant_id in (
      select tm.tenant_id
        from tenant_members tm
       where tm.user_id = auth.uid()
         and tm.is_active
         and tm.role in ('owner', 'accountant')
    )
  );

-- 6. Index for the queue page query (status + method + tenant + created_at).
create index if not exists idx_booking_payments_pending_drafts
  on booking_payments (tenant_id, created_at)
  where status = 'pending' and method = 'bank_draft';

-- 7. Trigger: when a booking is cancelled, auto-fail any pending bank drafts on it.
--    (Spec §12 edge case 3.) Reason text is fixed; no SMS dispatched from the
--    trigger — the cancellation flow itself is the cancellation notification.
create or replace function fail_pending_drafts_on_booking_cancel()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update booking_payments
       set status          = 'failed',
           rejected_reason = 'booking cancelled',
           rejected_at     = now()
     where booking_id = new.id
       and method     = 'bank_draft'
       and status     = 'pending';
  end if;
  return new;
end $$;

drop trigger if exists fail_drafts_on_cancel on bookings;
create trigger fail_drafts_on_cancel
  after update of status on bookings
  for each row execute function fail_pending_drafts_on_booking_cancel();
```

- [ ] **Step 2: Apply the migration**

Run:
```bash
supabase db push
```

Expected: `Applying migration 20240001000055_bank_draft_submissions.sql ...` and `Finished supabase db push`.

If you get an error like "cannot ALTER TYPE in transaction": Postgres requires `alter type ... add value` to be outside a transaction. Run the migration in two separate statements via psql:
```bash
psql "$DATABASE_URL" -c "alter type payment_method add value if not exists 'bank_draft';"
supabase db push
```

- [ ] **Step 3: Verify schema in psql**

Run:
```bash
psql "$DATABASE_URL" -c "\d booking_payments"
psql "$DATABASE_URL" -c "select unnest(enum_range(null::payment_method));"
psql "$DATABASE_URL" -c "\d tenants" | grep -i bank
```

Expected: see new columns on `booking_payments`, `bank_draft` in the enum range output, bank_* columns on `tenants`.

- [ ] **Step 4: Verify the partial unique index works**

Run:
```sql
-- Pick any real booking_id from your dev DB.
-- Replace <booking_id>, <tenant_id> with real UUIDs.
insert into booking_payments (tenant_id, booking_id, amount, method, status)
  values ('<tenant_id>', '<booking_id>', 100, 'bank_draft', 'pending');
insert into booking_payments (tenant_id, booking_id, amount, method, status)
  values ('<tenant_id>', '<booking_id>', 200, 'bank_draft', 'pending');
-- Second insert MUST fail with: duplicate key violates unique constraint "booking_payments_one_pending_draft"
delete from booking_payments where method = 'bank_draft' and status = 'pending' and booking_id = '<booking_id>';
```

Expected: first insert succeeds, second fails with the unique constraint error, cleanup succeeds.

- [ ] **Step 5: Commit**

Run:
```bash
git add supabase/migrations/20240001000055_bank_draft_submissions.sql
git commit -m "feat(payments): migration 055 — bank draft submissions schema"
```

---

### Task 2: Migration 056 — Storage bucket

**Files:**
- Create: `supabase/migrations/20240001000056_bank_drafts_storage_bucket.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20240001000056_bank_drafts_storage_bucket.sql`:

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 056 — Bank Drafts Storage Bucket
-- Private bucket for student-uploaded bank draft files. RLS restricts:
--   - INSERT: occupant uploading to a path under their own tenant + booking
--   - SELECT: same occupant + tenant owner/accountant
--   - No UPDATE, no DELETE policies (cancellation goes through the API
--     route using the service role).
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bank-drafts',
  'bank-drafts',
  false,
  5242880,  -- 5 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic']
)
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public             = excluded.public;

-- Path convention: {tenant_id}/{booking_id}/{payment_id}.{ext}
-- (storage.foldername(name) returns the path segments as text[])

create policy "occupant uploads own bank draft"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'bank-drafts'
    and exists (
      select 1
        from bookings b
        join occupants o on o.id = b.occupant_id
       where o.user_id  = auth.uid()
         and b.tenant_id::text = (storage.foldername(name))[1]
         and b.id::text        = (storage.foldername(name))[2]
    )
  );

create policy "occupant reads own bank draft"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'bank-drafts'
    and exists (
      select 1
        from bookings b
        join occupants o on o.id = b.occupant_id
       where o.user_id  = auth.uid()
         and b.tenant_id::text = (storage.foldername(name))[1]
         and b.id::text        = (storage.foldername(name))[2]
    )
  );

create policy "owner or accountant reads tenant bank drafts"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'bank-drafts'
    and (storage.foldername(name))[1] in (
      select tm.tenant_id::text
        from tenant_members tm
       where tm.user_id = auth.uid()
         and tm.is_active
         and tm.role in ('owner', 'accountant')
    )
  );
```

- [ ] **Step 2: Apply the migration**

Run:
```bash
supabase db push
```

Expected: applied without error.

- [ ] **Step 3: Verify in psql**

Run:
```bash
psql "$DATABASE_URL" -c "select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'bank-drafts';"
psql "$DATABASE_URL" -c "select policyname, cmd from pg_policies where tablename='objects' and policyname like '%bank draft%';"
```

Expected: bucket exists with the right limits; three storage policies appear.

- [ ] **Step 4: Commit**

Run:
```bash
git add supabase/migrations/20240001000056_bank_drafts_storage_bucket.sql
git commit -m "feat(payments): migration 056 — bank-drafts storage bucket"
```

---

## Phase 2 — Tenant settings (so admin can configure deposit details first)

### Task 3: Bank deposit form on settings page

**Files:**
- Create: `apps/web/components/settings/bank-deposit-form.tsx`
- Modify: `apps/web/app/api/settings/branding/route.ts` (extend schema + persistence)
- Modify: `apps/web/app/(tenant)/settings/page.tsx` (mount the form)

- [ ] **Step 1: Extend the settings PATCH route schema**

Open `apps/web/app/api/settings/branding/route.ts`. Locate the `schema` zod object. Append these fields BEFORE the closing `})`:

```ts
  // Bank deposit details (migration 055)
  bank_name:             z.string().max(120).optional().nullable(),
  bank_branch:           z.string().max(120).optional().nullable(),
  bank_account_name:     z.string().max(120).optional().nullable(),
  bank_account_number:   z.string().regex(/^[0-9 -]{6,40}$/, 'Account number must be 6+ digits').optional().nullable(),
  bank_swift_code:       z.string().regex(/^[A-Z0-9]{8}([A-Z0-9]{3})?$/, 'Invalid SWIFT/BIC').optional().nullable(),
  bank_instructions:     z.string().max(280).optional().nullable(),
  bank_deposits_enabled: z.boolean().optional(),
```

Then locate where the route writes parsed data to `tenants` (the `.update({...})` call). Either it spreads `parsed.data` directly (no change needed) or it whitelists fields (add the new field names to the whitelist).

After the update succeeds, add this auto-enable rule before the response is returned (find a sensible spot after the `.update(...)` call):

```ts
// Auto-enable bank deposits the first time all required fields are saved
// together. After that, owner can toggle freely via the explicit boolean.
const requiredFilled =
  parsed.data.bank_name           &&
  parsed.data.bank_account_name   &&
  parsed.data.bank_account_number
if (requiredFilled && parsed.data.bank_deposits_enabled === undefined) {
  await admin
    .from('tenants')
    .update({ bank_deposits_enabled: true })
    .eq('id', tenantId)
    .eq('bank_deposits_enabled', false)   // only flip if currently false
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @gh-hostels/web type-check`

Expected: 0 errors.

- [ ] **Step 3: Create the form component**

Create `apps/web/components/settings/bank-deposit-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Banknote, Copy, Check, Loader2 } from 'lucide-react'

interface Props {
  tenantId: string
  initial: {
    bank_name:             string | null
    bank_branch:           string | null
    bank_account_name:     string | null
    bank_account_number:   string | null
    bank_swift_code:       string | null
    bank_instructions:     string | null
    bank_deposits_enabled: boolean
  }
  canEdit: boolean   // true for owner only
}

export function BankDepositForm({ tenantId, initial, canEdit }: Props) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await fetch('/api/settings/branding', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const requiredMissing =
    !form.bank_name || !form.bank_account_name || !form.bank_account_number

  return (
    <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <Banknote className="h-4 w-4 text-slate-400" />
            Bank Deposit Details
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Shown to residents on the payment page when they choose &quot;Pay by bank deposit.&quot;
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={form.bank_deposits_enabled}
            disabled={!canEdit || requiredMissing}
            onChange={e => update('bank_deposits_enabled', e.target.checked)}
            className="h-4 w-4"
          />
          Enabled
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Bank name *">
          <input className="form-input" value={form.bank_name ?? ''} onChange={e => update('bank_name', e.target.value || null)} disabled={!canEdit} maxLength={120} />
        </Field>
        <Field label="Branch">
          <input className="form-input" value={form.bank_branch ?? ''} onChange={e => update('bank_branch', e.target.value || null)} disabled={!canEdit} maxLength={120} />
        </Field>
        <Field label="Account name *">
          <input className="form-input" value={form.bank_account_name ?? ''} onChange={e => update('bank_account_name', e.target.value || null)} disabled={!canEdit} maxLength={120} />
        </Field>
        <Field label="Account number *">
          <input className="form-input font-mono" value={form.bank_account_number ?? ''} onChange={e => update('bank_account_number', e.target.value || null)} disabled={!canEdit} pattern="[0-9 -]{6,40}" />
        </Field>
        <Field label="SWIFT / BIC (optional)">
          <input className="form-input font-mono" value={form.bank_swift_code ?? ''} onChange={e => update('bank_swift_code', (e.target.value || null)?.toUpperCase() ?? null)} disabled={!canEdit} maxLength={11} />
        </Field>
        <Field label="Deposit instructions (optional, ≤280 chars)">
          <textarea className="form-input min-h-[68px]" value={form.bank_instructions ?? ''} onChange={e => update('bank_instructions', e.target.value || null)} disabled={!canEdit} maxLength={280} />
        </Field>
      </div>

      {requiredMissing && (
        <p className="text-xs text-amber-600">Fill bank name, account name, and account number to enable deposits.</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {canEdit && (
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? 'Saved' : 'Save bank details'}
        </button>
      )}
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  )
}
```

If your project doesn't already have a `.form-input` utility class in globals.css, replace `className="form-input"` with `className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"` (and the same for the textarea variant — keep the `min-h-[68px]`).

- [ ] **Step 4: Mount the form on the settings page**

Open `apps/web/app/(tenant)/settings/page.tsx`. Add at the top of the imports:

```tsx
import { BankDepositForm } from '@/components/settings/bank-deposit-form'
```

In the existing settings server component, ensure the tenant query selects the new bank columns. Find the `select(...)` call against `tenants` and add (or extend the existing select):

```ts
.select('id, name, primary_color, ..., bank_name, bank_branch, bank_account_name, bank_account_number, bank_swift_code, bank_instructions, bank_deposits_enabled')
```

Determine `canEdit` from the existing role check on the page (whatever is used for the existing "Branding" form — owner-only). If no per-section gating exists yet, derive it from `tenant_members`:

```ts
const { data: { user } } = await supabase.auth.getUser()
const { data: member } = await admin
  .from('tenant_members')
  .select('role')
  .eq('user_id', user!.id)
  .eq('tenant_id', tenant.id)
  .single()
const canEdit = member?.role === 'owner'
```

Render the form below the existing Branding section:

```tsx
<BankDepositForm
  tenantId={tenant.id}
  initial={{
    bank_name:             tenant.bank_name             ?? null,
    bank_branch:           tenant.bank_branch           ?? null,
    bank_account_name:     tenant.bank_account_name     ?? null,
    bank_account_number:   tenant.bank_account_number   ?? null,
    bank_swift_code:       tenant.bank_swift_code       ?? null,
    bank_instructions:     tenant.bank_instructions     ?? null,
    bank_deposits_enabled: tenant.bank_deposits_enabled ?? false,
  }}
  canEdit={canEdit}
/>
```

If the tenant has Paystack configured (`paystack_subaccount_code`) but bank fields are blank, render an amber banner above the form (one paragraph: "Add bank deposit details to give residents a second way to pay."). Skip the banner if `bank_name` is set.

- [ ] **Step 5: Type-check**

Run: `pnpm --filter @gh-hostels/web type-check`

Expected: 0 errors.

- [ ] **Step 6: Manual smoke test**

Run: `pnpm --filter @gh-hostels/web dev`

In a browser, log in as the owner of a test tenant. Visit `/settings`. Confirm:
- New "Bank Deposit Details" card renders below Branding.
- Form is editable (disabled if you log in as a non-owner role).
- Saving with all required fields populated returns success and the "Enabled" toggle becomes available.
- After saving, refresh: values persist.
- In psql: `select bank_name, bank_account_number, bank_deposits_enabled from tenants where id = '<tenant_id>'` — confirms the row.

- [ ] **Step 7: Commit**

Run:
```bash
git add apps/web/components/settings/bank-deposit-form.tsx \
        apps/web/app/api/settings/branding/route.ts \
        apps/web/app/\(tenant\)/settings/page.tsx
git commit -m "feat(settings): tenant bank deposit details form"
```

---

## Phase 3 — Shared helpers

### Task 4: `requireTenantRole` auth helper

**Files:**
- Create: `apps/web/lib/auth/tenant-role.ts`

- [ ] **Step 1: Write the helper**

Create `apps/web/lib/auth/tenant-role.ts`:

```ts
/**
 * Role gate for tenant-side API routes.
 *
 * Verifies the authenticated user is an active tenant_member of the given
 * tenant with one of the allowed roles. Returns the resolved member record
 * on success, or a NextResponse error to short-circuit the route.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@gh-hostels/types'

export type TenantRole = Database['public']['Enums']['tenant_role']

export interface TenantRoleContext {
  userId:   string
  tenantId: string
  role:     TenantRole
}

export async function requireTenantRole(
  tenantId: string,
  allowed: TenantRole[],
): Promise<TenantRoleContext | NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('tenant_members')
    .select('role, is_active')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .single()

  if (!member || !member.is_active) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!allowed.includes(member.role as TenantRole)) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 })
  }

  return { userId: user.id, tenantId, role: member.role as TenantRole }
}
```

If `@gh-hostels/types` doesn't export `Database` or `Enums`, replace the type alias with `export type TenantRole = 'owner' | 'manager' | 'receptionist' | 'housekeeper' | 'accountant' | 'security' | 'occupant'`.

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @gh-hostels/web type-check`

Expected: 0 errors.

- [ ] **Step 3: Commit**

Run:
```bash
git add apps/web/lib/auth/tenant-role.ts
git commit -m "feat(auth): requireTenantRole helper for role-gated routes"
```

---

### Task 5: `lib/bank-draft.ts` validation + dispatch helpers

**Files:**
- Create: `apps/web/lib/bank-draft.ts`
- Modify: `apps/web/lib/sms.ts` (append three new typed helpers)

- [ ] **Step 1: Add SMS helpers**

Open `apps/web/lib/sms.ts`. After the existing `sendPaymentReceipt` function, append:

```ts
/* ── Bank draft notifications (migration 055) ────────────────────── */

export async function sendBankDraftSubmittedToAdmin(params: {
  phone:        string
  studentName:  string
  amountGHS:    string
  bookingRef:   string
  hostelName:   string
  reviewUrl:    string
  tenantId?:    string
}) {
  const fallback =
    'New bank draft on {{hostel_name}}: {{student_name}} uploaded ' +
    'GHS {{amount}} for {{booking_ref}}. Review: {{review_url}}'

  const msg = await resolveSmsBody('bank_draft_submitted', fallback, {
    student_name: params.studentName,
    amount:       params.amountGHS,
    booking_ref:  params.bookingRef,
    hostel_name:  params.hostelName,
    review_url:   params.reviewUrl,
  }, params.tenantId)

  await send(params.phone, msg)
}

export async function sendBankDraftApproved(params: {
  phone:       string
  firstName:   string
  amountGHS:   string
  bookingRef:  string
  balanceGHS:  string
  hostelName:  string
  tenantId?:   string
}) {
  const fallback =
    'Hi {{first_name}}, your bank draft of GHS {{amount}} for booking ' +
    '{{booking_ref}} at {{hostel_name}} has been confirmed. ' +
    'Outstanding balance: GHS {{balance}}. Thank you.'

  const msg = await resolveSmsBody('bank_draft_approved', fallback, {
    first_name:  params.firstName,
    amount:      params.amountGHS,
    booking_ref: params.bookingRef,
    balance:     params.balanceGHS,
    hostel_name: params.hostelName,
  }, params.tenantId)

  await send(params.phone, msg)
}

export async function sendBankDraftRejected(params: {
  phone:       string
  firstName:   string
  amountGHS:   string
  bookingRef:  string
  reason:      string
  hostelName:  string
  tenantId?:   string
}) {
  const fallback =
    'Hi {{first_name}}, we couldn\'t confirm your bank draft of GHS ' +
    '{{amount}} for {{booking_ref}} ({{hostel_name}}). Reason: {{reason}}. ' +
    'Please re-upload via the resident portal.'

  const msg = await resolveSmsBody('bank_draft_rejected', fallback, {
    first_name:  params.firstName,
    amount:      params.amountGHS,
    booking_ref: params.bookingRef,
    reason:      params.reason,
    hostel_name: params.hostelName,
  }, params.tenantId)

  await send(params.phone, msg)
}
```

- [ ] **Step 2: Add the three event names to `lib/notifications/defaults.ts`**

Open `apps/web/lib/notifications/defaults.ts`. Locate the `EventType` union and the DEFAULT_TEMPLATES record. Add:

```ts
// In the EventType union:
| 'bank_draft_submitted'
| 'bank_draft_approved'
| 'bank_draft_rejected'

// In DEFAULT_TEMPLATES (follow the existing structure for sms entries):
'bank_draft_submitted': {
  sms: { subject: null, body:
    'New bank draft on {{hostel_name}}: {{student_name}} uploaded ' +
    'GHS {{amount}} for {{booking_ref}}. Review: {{review_url}}' },
},
'bank_draft_approved': {
  sms: { subject: null, body:
    'Hi {{first_name}}, your bank draft of GHS {{amount}} for booking ' +
    '{{booking_ref}} at {{hostel_name}} has been confirmed. ' +
    'Outstanding balance: GHS {{balance}}. Thank you.' },
},
'bank_draft_rejected': {
  sms: { subject: null, body:
    'Hi {{first_name}}, we couldn\'t confirm your bank draft of GHS ' +
    '{{amount}} for {{booking_ref}} ({{hostel_name}}). Reason: {{reason}}. ' +
    'Please re-upload via the resident portal.' },
},
```

If the file structure differs from this shape, mirror whatever existing keys like `payment_received` use exactly.

- [ ] **Step 3: Create `lib/bank-draft.ts`**

Create `apps/web/lib/bank-draft.ts`:

```ts
/**
 * Bank draft helpers — file validation, storage paths, signed URLs,
 * and notification dispatch.
 *
 * All money values in this module are pesewas unless explicitly named
 * with GHS suffix. Conversion happens only at the SMS / display boundary.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToTenant } from '@/lib/push'
import {
  sendBankDraftSubmittedToAdmin,
  sendBankDraftApproved,
  sendBankDraftRejected,
} from '@/lib/sms'

export const BANK_DRAFTS_BUCKET = 'bank-drafts'
export const MAX_DRAFT_BYTES    = 5 * 1024 * 1024
export const ALLOWED_DRAFT_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'] as const

export const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg':      'jpg',
  'image/png':       'png',
  'image/heic':      'heic',
}

export type DraftMime = typeof ALLOWED_DRAFT_MIME[number]

export interface ValidatedDraftFile {
  bytes: ArrayBuffer
  mime:  DraftMime
  ext:   string
  size:  number
}

export function validateDraftFile(file: File): ValidatedDraftFile | { error: string } {
  if (!file || file.size === 0) return { error: 'File is required' }
  if (file.size > MAX_DRAFT_BYTES) return { error: 'File is larger than 5 MB' }
  if (!ALLOWED_DRAFT_MIME.includes(file.type as DraftMime)) {
    return { error: 'File must be PDF, JPG, PNG, or HEIC' }
  }
  return {
    bytes: undefined as unknown as ArrayBuffer,   // caller awaits file.arrayBuffer() separately
    mime:  file.type as DraftMime,
    ext:   EXT_BY_MIME[file.type] ?? 'bin',
    size:  file.size,
  }
}

export function buildDraftPath(tenantId: string, bookingId: string, paymentId: string, ext: string) {
  return `${tenantId}/${bookingId}/${paymentId}.${ext}`
}

export async function getSignedDraftUrl(path: string, expiresInSeconds = 600): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(BANK_DRAFTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds)
  if (error || !data) return null
  return data.signedUrl
}

/* ── Notification dispatch ───────────────────────────────────────── */

interface DispatchSubmittedArgs {
  tenantId:    string
  studentName: string
  amount:      number      // pesewas
  bookingRef:  string
  paymentId:   string
}

export async function dispatchDraftSubmitted(args: DispatchSubmittedArgs): Promise<void> {
  const admin = createAdminClient()
  const { data: tenant } = await admin
    .from('tenants')
    .select('name, slug')
    .eq('id', args.tenantId)
    .single()
  const hostelName = tenant?.name ?? 'Hostel'

  // Web push to all subscribed sessions for this tenant. (sendPushToTenant
  // dispatches to every push subscription registered for the tenant.)
  await sendPushToTenant(args.tenantId, {
    title: 'New bank draft to verify',
    body:  `${args.studentName} uploaded GHS ${(args.amount / 100).toFixed(2)} for ${args.bookingRef}`,
    url:   `/payments/drafts?focus=${args.paymentId}`,
    tag:   `draft-${args.paymentId}`,
  })

  // SMS to owners + accountants who have a phone on file.
  const { data: recipients } = await admin
    .from('tenant_members')
    .select('user_id, role, users:auth.users(email), staff:staff!inner(phone)')   // see note below
    .eq('tenant_id', args.tenantId)
    .eq('is_active', true)
    .in('role', ['owner', 'accountant'])

  // NOTE: the join above is illustrative. Run whatever query in YOUR
  // codebase reliably resolves a tenant_member's contact phone. If you
  // store contact phone on a `staff` table linked by user_id, do that.
  // If on `tenants.contact_phone`, fall back to that single number.
  // If neither, log and skip SMS.
  const phones = new Set<string>()
  for (const r of recipients ?? []) {
    const phone = (r as any).staff?.phone
    if (phone) phones.add(phone)
  }
  if (phones.size === 0) {
    const { data: tFallback } = await admin
      .from('tenants')
      .select('contact_phone')
      .eq('id', args.tenantId)
      .single()
    if (tFallback?.contact_phone) phones.add(tFallback.contact_phone)
  }

  const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/payments/drafts`

  for (const phone of phones) {
    await sendBankDraftSubmittedToAdmin({
      phone,
      studentName: args.studentName,
      amountGHS:   (args.amount / 100).toFixed(2),
      bookingRef:  args.bookingRef,
      hostelName,
      reviewUrl,
      tenantId:    args.tenantId,
    })
  }
}

interface DispatchDecisionArgs {
  tenantId:   string
  occupantId: string
  amount:     number      // pesewas
  bookingId:  string
  bookingRef: string
}

export async function dispatchDraftApproved(args: DispatchDecisionArgs): Promise<void> {
  const admin = createAdminClient()
  const { data: occupant } = await admin
    .from('occupants')
    .select('first_name, phone')
    .eq('id', args.occupantId)
    .single()
  const { data: booking } = await admin
    .from('bookings')
    .select('final_amount, paid_amount')
    .eq('id', args.bookingId)
    .single()
  const { data: tenant } = await admin
    .from('tenants')
    .select('name')
    .eq('id', args.tenantId)
    .single()

  if (!occupant?.phone) return
  const balance = Math.max(0, (booking?.final_amount ?? 0) - (booking?.paid_amount ?? 0))

  await sendBankDraftApproved({
    phone:       occupant.phone,
    firstName:   occupant.first_name ?? 'there',
    amountGHS:   (args.amount / 100).toFixed(2),
    bookingRef:  args.bookingRef,
    balanceGHS:  (balance / 100).toFixed(2),
    hostelName:  tenant?.name ?? 'Hostel',
    tenantId:    args.tenantId,
  })
}

export async function dispatchDraftRejected(args: DispatchDecisionArgs & { reason: string }): Promise<void> {
  const admin = createAdminClient()
  const { data: occupant } = await admin
    .from('occupants')
    .select('first_name, phone')
    .eq('id', args.occupantId)
    .single()
  const { data: tenant } = await admin
    .from('tenants')
    .select('name')
    .eq('id', args.tenantId)
    .single()

  if (!occupant?.phone) return

  await sendBankDraftRejected({
    phone:       occupant.phone,
    firstName:   occupant.first_name ?? 'there',
    amountGHS:   (args.amount / 100).toFixed(2),
    bookingRef:  args.bookingRef,
    reason:      args.reason,
    hostelName:  tenant?.name ?? 'Hostel',
    tenantId:    args.tenantId,
  })
}
```

> **Note on the recipients query:** the join syntax shown above is pseudo-code. Look at how the existing `lib/sms.ts` callers (e.g. anywhere that sends SMS to staff) resolve a staff member's phone for a tenant_member, and replicate that exact query. If staff contact phones aren't stored, fall back to `tenants.contact_phone` as shown.

- [ ] **Step 4: Type-check**

Run: `pnpm --filter @gh-hostels/web type-check`

Expected: 0 errors. Fix any type mismatches with the actual `lib/notifications/defaults.ts` shape if your edits in Step 2 need adjusting.

- [ ] **Step 5: Commit**

Run:
```bash
git add apps/web/lib/bank-draft.ts apps/web/lib/sms.ts apps/web/lib/notifications/defaults.ts
git commit -m "feat(payments): bank-draft helpers + SMS templates"
```

---

## Phase 4 — Student-side

### Task 6: `POST /api/occupant/bank-draft` (upload)

**Files:**
- Create: `apps/web/app/api/occupant/bank-draft/route.ts`

- [ ] **Step 1: Write the route**

Create `apps/web/app/api/occupant/bank-draft/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import {
  BANK_DRAFTS_BUCKET,
  ALLOWED_DRAFT_MIME,
  MAX_DRAFT_BYTES,
  EXT_BY_MIME,
  buildDraftPath,
  dispatchDraftSubmitted,
  type DraftMime,
} from '@/lib/bank-draft'

const formSchema = z.object({
  booking_id:    z.string().uuid(),
  amount:        z.coerce.number().int().positive(),         // pesewas
  draft_number:  z.string().min(1).max(40),
  bank_name:     z.string().min(2).max(120),
  deposit_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note:          z.string().max(140).optional().nullable(),
})

export async function POST(req: NextRequest) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let form: FormData
  try { form = await req.formData() }
  catch { return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 }) }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required' }, { status: 422 })
  }
  if (file.size === 0)                           return NextResponse.json({ error: 'File is empty' },                  { status: 422 })
  if (file.size > MAX_DRAFT_BYTES)               return NextResponse.json({ error: 'File is larger than 5 MB' },       { status: 422 })
  if (!ALLOWED_DRAFT_MIME.includes(file.type as DraftMime)) {
    return NextResponse.json({ error: 'File must be PDF, JPG, PNG, or HEIC' }, { status: 422 })
  }

  const fields = {
    booking_id:   form.get('booking_id'),
    amount:       form.get('amount'),
    draft_number: form.get('draft_number'),
    bank_name:    form.get('bank_name'),
    deposit_date: form.get('deposit_date'),
    note:         form.get('note') || null,
  }
  const parsed = formSchema.safeParse(fields)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 422 })
  }

  const admin = createAdminClient()

  // Tenant must allow bank deposits.
  const { data: tenant } = await admin
    .from('tenants')
    .select('bank_deposits_enabled, name')
    .eq('id', session.tenantId)
    .single()
  if (!tenant?.bank_deposits_enabled) {
    return NextResponse.json({ error: 'Bank deposits not enabled for this hostel' }, { status: 403 })
  }

  // Booking must belong to this occupant + tenant, and have outstanding balance.
  const { data: booking } = await admin
    .from('bookings')
    .select('id, booking_ref, final_amount, paid_amount, status, occupant_id')
    .eq('id', parsed.data.booking_id)
    .eq('tenant_id', session.tenantId)
    .eq('occupant_id', session.occupantId)
    .single()
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.status === 'cancelled') return NextResponse.json({ error: 'Booking is cancelled' }, { status: 400 })

  const balance = booking.final_amount - booking.paid_amount
  if (balance <= 0) return NextResponse.json({ error: 'No outstanding balance on this booking' }, { status: 400 })

  // Single-pending guarantee — friendly check (DB unique index is the hard guard).
  const { count: pendingCount } = await admin
    .from('booking_payments')
    .select('id', { head: true, count: 'exact' })
    .eq('booking_id', booking.id)
    .eq('method', 'bank_draft')
    .eq('status', 'pending')
  if ((pendingCount ?? 0) > 0) {
    return NextResponse.json(
      { error: 'You already have a draft awaiting verification on this booking.' },
      { status: 409 },
    )
  }

  // 1. Insert payment row first (gets us the id for the storage path).
  const { data: payment, error: insertErr } = await admin
    .from('booking_payments')
    .insert({
      tenant_id:           session.tenantId,
      booking_id:          booking.id,
      amount:              parsed.data.amount,
      method:              'bank_draft',
      status:              'pending',
      reference:           parsed.data.draft_number,
      draft_bank_name:     parsed.data.bank_name,
      draft_number:        parsed.data.draft_number,
      draft_deposit_date:  parsed.data.deposit_date,
      draft_note:          parsed.data.note,
      received_by:         session.userId,
    })
    .select('id')
    .single()

  if (insertErr || !payment) {
    if (insertErr?.message?.includes('booking_payments_one_pending_draft')) {
      return NextResponse.json(
        { error: 'You already have a draft awaiting verification on this booking.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 })
  }

  // 2. Upload file to bucket.
  const ext  = EXT_BY_MIME[file.type] ?? 'bin'
  const path = buildDraftPath(session.tenantId, booking.id, payment.id, ext)
  const buf  = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await admin.storage
    .from(BANK_DRAFTS_BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: false })

  if (uploadErr) {
    // Roll back the row to avoid orphans.
    await admin.from('booking_payments').delete().eq('id', payment.id)
    return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 })
  }

  // 3. Update row with file path.
  await admin
    .from('booking_payments')
    .update({ draft_file_path: path })
    .eq('id', payment.id)

  // 4. Fire-and-forget notifications.
  after(async () => {
    try {
      await dispatchDraftSubmitted({
        tenantId:    session.tenantId,
        studentName: `${session.firstName} ${session.lastName}`.trim(),
        amount:      parsed.data.amount,
        bookingRef:  booking.booking_ref,
        paymentId:   payment.id,
      })
    } catch (e) {
      console.error('[bank-draft] notify dispatch failed', e)
    }
  })

  return NextResponse.json({ payment_id: payment.id, status: 'pending' }, { status: 201 })
}
```

> Note on `after`: Next.js 15+ exposes `after` from `next/server` for "waitUntil" semantics. If your Next version is older or hasn't enabled it, replace `after(async () => {...})` with a non-blocking immediately-invoked async IIFE — fire-and-forget — but DO log errors.

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @gh-hostels/web type-check`

Expected: 0 errors.

- [ ] **Step 3: Manual smoke test (CLI)**

Start dev: `pnpm --filter @gh-hostels/web dev`. Log in as a test occupant in the browser, copy their session cookie, then in another terminal:

```bash
# Replace <cookie>, <booking_id>, <appropriate-domain>
curl -i -X POST 'http://localhost:3000/api/occupant/bank-draft' \
  -H 'cookie: <session-cookie-here>' \
  -F 'booking_id=<booking_id>' \
  -F 'amount=120000' \
  -F 'draft_number=TEST-001' \
  -F 'bank_name=GCB Bank' \
  -F 'deposit_date=2026-05-05' \
  -F 'note=smoke test' \
  -F 'file=@/path/to/sample-draft.pdf'
```

Expected: `201 Created`, body `{ "payment_id": "...", "status": "pending" }`.

Verify in psql:
```sql
select id, amount, method, status, draft_number, draft_bank_name, draft_file_path
  from booking_payments
 where booking_id = '<booking_id>' and method = 'bank_draft'
 order by created_at desc limit 1;
```

Expected: row exists with `status='pending'`, `method='bank_draft'`, `draft_file_path` populated.

In Supabase Studio → Storage → `bank-drafts`, confirm the file landed at `<tenant_id>/<booking_id>/<payment_id>.pdf`.

Try uploading again with the same booking — expect 409.

- [ ] **Step 4: Commit**

Run:
```bash
git add apps/web/app/api/occupant/bank-draft/route.ts
git commit -m "feat(occupant): POST /api/occupant/bank-draft upload route"
```

---

### Task 7: `DELETE /api/occupant/bank-draft/[id]` (cancel)

**Files:**
- Create: `apps/web/app/api/occupant/bank-draft/[id]/route.ts`

- [ ] **Step 1: Write the route**

Create `apps/web/app/api/occupant/bank-draft/[id]/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { BANK_DRAFTS_BUCKET } from '@/lib/bank-draft'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Verify the row belongs to this occupant + tenant AND is pending.
  const { data: row } = await admin
    .from('booking_payments')
    .select('id, status, method, draft_file_path, booking:bookings!inner(occupant_id, tenant_id)')
    .eq('id', id)
    .single()

  const booking = Array.isArray(row?.booking) ? row?.booking[0] : (row?.booking as any)
  const owns = !!row && booking?.occupant_id === session.occupantId && booking?.tenant_id === session.tenantId

  if (!row || !owns)                      return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.method !== 'bank_draft')        return NextResponse.json({ error: 'Not a bank draft' }, { status: 400 })
  if (row.status !== 'pending')           return NextResponse.json({ error: 'Only pending drafts can be cancelled' }, { status: 400 })

  // 1. Delete the file first. If this fails, keep the row (retryable).
  if (row.draft_file_path) {
    const { error: storageErr } = await admin.storage
      .from(BANK_DRAFTS_BUCKET)
      .remove([row.draft_file_path])
    if (storageErr) {
      return NextResponse.json({ error: 'Could not delete file. Try again.' }, { status: 503 })
    }
  }

  // 2. Then delete the row.
  const { error: deleteErr } = await admin
    .from('booking_payments')
    .delete()
    .eq('id', id)
    .eq('status', 'pending')   // optimistic lock: don't delete a row that just got approved

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @gh-hostels/web type-check`

Expected: 0 errors.

- [ ] **Step 3: Manual smoke test**

Using the payment_id from Task 6:

```bash
curl -i -X DELETE 'http://localhost:3000/api/occupant/bank-draft/<payment_id>' \
  -H 'cookie: <session-cookie>'
```

Expected: `200 OK`. Verify in psql the row is gone, and in Supabase Storage the file is gone.

- [ ] **Step 4: Commit**

Run:
```bash
git add apps/web/app/api/occupant/bank-draft/\[id\]/route.ts
git commit -m "feat(occupant): DELETE bank draft cancel route"
```

---

### Task 8: `BankDepositSection` client component

**Files:**
- Create: `apps/web/components/occupant-portal/bank-deposit-section.tsx`

- [ ] **Step 1: Write the component**

Create `apps/web/components/occupant-portal/bank-deposit-section.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Building2, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import { DraftUploadForm } from './draft-upload-form'
import { PendingDraftCard } from './pending-draft-card'

interface BankDetails {
  bank_name:           string | null
  bank_branch:         string | null
  bank_account_name:   string | null
  bank_account_number: string | null
  bank_swift_code:     string | null
  bank_instructions:   string | null
}

interface PendingDraft {
  id:                  string
  amount:              number   // pesewas
  draft_number:        string | null
  created_at:          string
}

interface Props {
  bookingId:    string
  balance:      number          // pesewas
  bankDetails:  BankDetails
  pending:      PendingDraft | null
  color:        string
}

export function BankDepositSection({ bookingId, balance, bankDetails, pending, color }: Props) {
  const [open, setOpen] = useState(false)

  if (balance <= 0 && !pending) return null
  if (!bankDetails.bank_name || !bankDetails.bank_account_name || !bankDetails.bank_account_number) return null

  const subLabel = pending ? '1 draft awaiting verification' : 'Upload your bank draft after depositing'

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
          <Building2 className="h-4 w-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">Pay by bank deposit</p>
          <p className="text-[11px] text-slate-500">{subLabel}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {pending ? (
            <PendingDraftCard pending={pending} />
          ) : (
            <>
              <BankDetailsBlock details={bankDetails} />
              <div className="border-t border-slate-100 px-5 py-2 text-center text-[11px] text-slate-400">
                — After you&apos;ve deposited, upload your draft —
              </div>
              <DraftUploadForm
                bookingId={bookingId}
                defaultAmount={balance}
                defaultBank={bankDetails.bank_name ?? ''}
                color={color}
              />
            </>
          )}
        </div>
      )}
    </section>
  )
}

function BankDetailsBlock({ details }: { details: BankDetails }) {
  return (
    <div className="bg-slate-50 px-5 py-4">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Deposit to this account</p>
      <Row label="Bank"        value={details.bank_name!} />
      {details.bank_branch && <Row label="Branch" value={details.bank_branch} />}
      <Row label="Account name" value={details.bank_account_name!} />
      <Row label="Account no." value={details.bank_account_number!} mono copyable />
      {details.bank_swift_code && <Row label="SWIFT" value={details.bank_swift_code} mono />}
      {details.bank_instructions && (
        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-[11px] leading-relaxed text-slate-600">
          {details.bank_instructions}
        </p>
      )}
    </div>
  )
}

function Row({ label, value, mono, copyable }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="flex items-center justify-between border-b border-dashed border-slate-200 py-2 last:border-b-0">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`flex items-center gap-2 text-[12px] font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>
        {value}
        {copyable && (
          <button type="button" onClick={copy} className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-700 hover:bg-slate-300">
            {copied ? <Check className="h-3 w-3" /> : 'Copy'}
          </button>
        )}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @gh-hostels/web type-check`

Expected: 0 errors. (`DraftUploadForm` and `PendingDraftCard` don't exist yet — type errors are OK at this point. Defer the type-check until task 10.)

- [ ] **Step 3: Commit (deferred — bundle with tasks 9 + 10)**

Don't commit yet. Continue to Task 9.

---

### Task 9: `DraftUploadForm` client component

**Files:**
- Create: `apps/web/components/occupant-portal/draft-upload-form.tsx`

- [ ] **Step 1: Write the component**

Create `apps/web/components/occupant-portal/draft-upload-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, FileText, X } from 'lucide-react'

interface Props {
  bookingId:     string
  defaultAmount: number   // pesewas
  defaultBank:   string
  color:         string
}

const TODAY = new Date().toISOString().slice(0, 10)

function ghsString(pesewas: number) {
  return (pesewas / 100).toFixed(2)
}
function pesewasFromInput(input: string): number {
  // Accepts "3,600", "3600.50", "3,600.5"
  const cleaned = input.replace(/[^0-9.]/g, '')
  const cedis   = parseFloat(cleaned)
  if (Number.isNaN(cedis) || cedis <= 0) return 0
  return Math.round(cedis * 100)
}

export function DraftUploadForm({ bookingId, defaultAmount, defaultBank, color }: Props) {
  const router = useRouter()
  const [file,         setFile]         = useState<File | null>(null)
  const [amountInput,  setAmountInput]  = useState(ghsString(defaultAmount))
  const [draftNumber,  setDraftNumber]  = useState('')
  const [bankName,     setBankName]     = useState(defaultBank)
  const [depositDate,  setDepositDate]  = useState(TODAY)
  const [note,         setNote]         = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const amountPesewas = pesewasFromInput(amountInput)
  const ready = !!file && amountPesewas > 0 && draftNumber.length > 0 && bankName.length > 1 && /^\d{4}-\d{2}-\d{2}$/.test(depositDate)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready || !file) return
    setSubmitting(true); setError(null)

    const fd = new FormData()
    fd.append('booking_id',   bookingId)
    fd.append('amount',       String(amountPesewas))
    fd.append('draft_number', draftNumber)
    fd.append('bank_name',    bankName)
    fd.append('deposit_date', depositDate)
    if (note) fd.append('note', note)
    fd.append('file',         file)

    try {
      const res  = await fetch('/api/occupant/bank-draft', { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Submission failed')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 px-5 pb-4 pt-2">
      <FilePicker file={file} setFile={setFile} setError={setError} />

      <div className="grid grid-cols-2 gap-2">
        <Field label="Amount (GH₵)">
          <input
            inputMode="decimal"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono"
            value={amountInput}
            onChange={e => setAmountInput(e.target.value)}
          />
        </Field>
        <Field label="Draft #">
          <input
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono"
            value={draftNumber}
            onChange={e => setDraftNumber(e.target.value)}
            maxLength={40}
          />
        </Field>
        <Field label="Bank">
          <input
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            value={bankName}
            onChange={e => setBankName(e.target.value)}
            maxLength={120}
          />
        </Field>
        <Field label="Deposit date">
          <input
            type="date"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            value={depositDate}
            onChange={e => setDepositDate(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Note (optional)">
        <input
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={140}
          placeholder="e.g. 1st semester room fees"
        />
      </Field>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!ready || submitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-50"
        style={{ backgroundColor: color }}
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Submit for verification
      </button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function FilePicker({
  file, setFile, setError,
}: { file: File | null; setFile: (f: File | null) => void; setError: (s: string | null) => void }) {
  return (
    <label className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-5 text-center hover:border-slate-400">
      {file ? (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-700">
          <FileText className="h-4 w-4" />
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setFile(null) }}
            className="rounded p-1 hover:bg-slate-100"
          >
            <X className="h-3.5 w-3.5 text-slate-500" />
          </button>
        </div>
      ) : (
        <>
          <FileText className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-1 text-xs font-medium text-slate-600">Tap to upload draft</p>
          <p className="text-[10px] text-slate-400">PDF / JPG / PNG / HEIC · max 5 MB</p>
        </>
      )}
      <input
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/heic"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0] ?? null
          if (f && f.size > 5 * 1024 * 1024) {
            setError('File is larger than 5 MB')
            return
          }
          setError(null)
          setFile(f)
        }}
      />
    </label>
  )
}
```

- [ ] **Step 2: Don't commit yet** — continue to Task 10.

---

### Task 10: `PendingDraftCard` client component

**Files:**
- Create: `apps/web/components/occupant-portal/pending-draft-card.tsx`

- [ ] **Step 1: Write the component**

Create `apps/web/components/occupant-portal/pending-draft-card.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Eye, X, Loader2 } from 'lucide-react'

interface Props {
  pending: {
    id:           string
    amount:       number
    draft_number: string | null
    created_at:   string
  }
}

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}
function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60)        return `${sec}s ago`
  if (sec < 3600)      return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400)     return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

export function PendingDraftCard({ pending }: Props) {
  const router = useRouter()
  const [viewLoading,   setViewLoading]   = useState(false)
  const [cancelling,    setCancelling]    = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  async function viewDraft() {
    setViewLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/occupant/bank-draft/${pending.id}/url`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.url) throw new Error(data?.error ?? 'Could not open file')
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (e: any) { setError(e.message) }
    finally { setViewLoading(false) }
  }

  async function cancel() {
    setCancelling(true); setError(null)
    try {
      const res = await fetch(`/api/occupant/bank-draft/${pending.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Cancel failed')
      }
      router.refresh()
    } catch (e: any) {
      setError(e.message)
      setCancelling(false)
    }
  }

  return (
    <div className="m-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
          <Clock className="h-4 w-4 text-amber-700" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-900">Awaiting verification</p>
          <p className="text-[11px] text-amber-700">
            {pending.draft_number ? `Draft #${pending.draft_number} · ` : ''}{ghs(pending.amount)} · {timeAgo(pending.created_at)}
          </p>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-700">{error}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={viewDraft}
          disabled={viewLoading}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-50"
        >
          {viewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
          View draft
        </button>

        {!confirmCancel ? (
          <button
            onClick={() => setConfirmCancel(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700"
          >
            <X className="h-3.5 w-3.5" /> Cancel submission
          </button>
        ) : (
          <button
            onClick={cancel}
            disabled={cancelling}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Tap again to confirm
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the signed-URL endpoint that PendingDraftCard calls**

Create `apps/web/app/api/occupant/bank-draft/[id]/url/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { BANK_DRAFTS_BUCKET, getSignedDraftUrl } from '@/lib/bank-draft'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin  = createAdminClient()

  const { data: row } = await admin
    .from('booking_payments')
    .select('id, draft_file_path, booking:bookings!inner(occupant_id)')
    .eq('id', id)
    .eq('tenant_id', session.tenantId)
    .single()

  const booking = Array.isArray(row?.booking) ? row?.booking[0] : (row?.booking as any)
  if (!row || booking?.occupant_id !== session.occupantId || !row.draft_file_path) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const url = await getSignedDraftUrl(row.draft_file_path, 600)
  if (!url) return NextResponse.json({ error: 'Could not sign URL' }, { status: 500 })
  return NextResponse.json({ url })
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @gh-hostels/web type-check`

Expected: 0 errors now (BankDepositSection's imports of DraftUploadForm and PendingDraftCard resolve).

- [ ] **Step 4: Commit (the bundle for tasks 8 + 9 + 10 + signed-url route)**

Run:
```bash
git add apps/web/components/occupant-portal/bank-deposit-section.tsx \
        apps/web/components/occupant-portal/draft-upload-form.tsx \
        apps/web/components/occupant-portal/pending-draft-card.tsx \
        apps/web/app/api/occupant/bank-draft/\[id\]/url/route.ts
git commit -m "feat(occupant): bank deposit section + upload form + pending card"
```

---

### Task 11: Wire `BankDepositSection` into `/occupant-portal/payments`

**Files:**
- Modify: `apps/web/app/(occupant-portal)/occupant-portal/payments/page.tsx`

- [ ] **Step 1: Extend the bookings query to include the bank fields and pending drafts**

Open the page. Inside the existing `bookingsRaw` fetch, the select already includes `booking_payments(...)`. We just need to add the new columns to that nested select. Change the existing nested select line:

From:
```ts
booking_payments(id, amount, method, reference, paystack_reference, paid_at, status, notes)
```
To:
```ts
booking_payments(id, amount, method, reference, paystack_reference, paid_at, status, notes, draft_file_path, draft_number, draft_bank_name, rejected_reason, created_at)
```

Add a fetch for the tenant's bank fields right after the existing tenant query (or inline into it):

```ts
const { data: tenantBank } = await admin
  .from('tenants')
  .select('bank_name, bank_branch, bank_account_name, bank_account_number, bank_swift_code, bank_instructions, bank_deposits_enabled')
  .eq('id', tenantId)
  .single()
```

- [ ] **Step 2: Compute the pending draft for the featured booking**

Right after `const featured = ...` block, add:

```ts
const featuredPayments = featured ? (Array.isArray(featured.booking_payments) ? featured.booking_payments : (featured.booking_payments ? [featured.booking_payments] : [])) : []
const pendingDraft = featuredPayments.find((p: any) => p.method === 'bank_draft' && p.status === 'pending') ?? null
```

- [ ] **Step 3: Render `BankDepositSection` below the existing balance + Pay Online card**

At the top of the file, add:
```ts
import { BankDepositSection } from '@/components/occupant-portal/bank-deposit-section'
```

Below the existing `</section>` that closes the featured-balance card, add:

```tsx
{featured && tenantBank?.bank_deposits_enabled && (
  <BankDepositSection
    bookingId={featured.id}
    balance={featuredBalance}
    bankDetails={{
      bank_name:           tenantBank.bank_name,
      bank_branch:         tenantBank.bank_branch,
      bank_account_name:   tenantBank.bank_account_name,
      bank_account_number: tenantBank.bank_account_number,
      bank_swift_code:     tenantBank.bank_swift_code,
      bank_instructions:   tenantBank.bank_instructions,
    }}
    pending={pendingDraft ? {
      id:           pendingDraft.id,
      amount:       pendingDraft.amount,
      draft_number: pendingDraft.draft_number ?? null,
      created_at:   pendingDraft.created_at,
    } : null}
    color={color}
  />
)}
```

- [ ] **Step 4: Update the payment-history list to render pending + rejected states**

Find the existing payment history `.map((p: any) => ...)` block. The current code branches on `isSuccess = p.status === 'success'`. Replace that branch with explicit handling:

```tsx
const isSuccess  = p.status === 'success'
const isPending  = p.status === 'pending'
const isRejected = p.status === 'failed'
const isDraft    = p.method === 'bank_draft'

// Status pill rendering:
{isSuccess && (
  <span className="flex items-center justify-end gap-0.5 text-[10px] text-emerald-600">
    <CheckCircle2 className="h-3 w-3" /> Confirmed
  </span>
)}
{isPending && (
  <span className="flex items-center justify-end gap-0.5 text-[10px] text-amber-600">
    <Clock className="h-3 w-3" /> Awaiting verification
  </span>
)}
{isRejected && (
  <span className="flex items-center justify-end gap-0.5 text-[10px] text-red-600">
    <XCircle className="h-3 w-3" /> Rejected
  </span>
)}
{isRejected && p.rejected_reason && (
  <p className="mt-0.5 max-w-[140px] truncate text-right text-[10px] text-red-500" title={p.rejected_reason}>
    {p.rejected_reason}
  </p>
)}
```

If `XCircle` isn't already imported in this file, add it to the lucide-react import line.

- [ ] **Step 5: Type-check**

Run: `pnpm --filter @gh-hostels/web type-check`

Expected: 0 errors.

- [ ] **Step 6: Manual smoke test**

Start dev. Log in as a test occupant whose hostel has bank deposits configured (Task 3). Visit `/occupant-portal/payments`. Confirm:
- "Pay by bank deposit" card appears below the balance card.
- Tapping expands to show bank details + upload form.
- Upload a sample PDF — submission succeeds and the section auto-collapses to the pending card.
- The pending row also shows in payment history with the amber clock pill.
- Tap "View draft" — opens a signed URL in a new tab; the file renders.
- Tap "Cancel submission" twice — row + file disappear; section reverts to the upload form.

- [ ] **Step 7: Commit**

Run:
```bash
git add apps/web/app/\(occupant-portal\)/occupant-portal/payments/page.tsx
git commit -m "feat(occupant): wire bank deposit section into payments page"
```

---

## Phase 5 — Admin (tenant) side

### Task 12: `POST /api/bank-drafts/[id]/approve`

**Files:**
- Create: `apps/web/app/api/bank-drafts/[id]/approve/route.ts`

- [ ] **Step 1: Write the route**

Create `apps/web/app/api/bank-drafts/[id]/approve/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { dispatchDraftApproved } from '@/lib/bank-draft'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const ctx = await requireTenantRole(tenantId, ['owner', 'accountant'])
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  const admin  = createAdminClient()

  // Optimistic-lock UPDATE: only flip if still pending.
  const { data: updated, error } = await admin
    .from('booking_payments')
    .update({
      status:       'success',
      paid_at:      new Date().toISOString(),
      approved_by:  ctx.userId,
      approved_at:  new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('method', 'bank_draft')
    .eq('status', 'pending')
    .select('id, amount, booking_id, booking:bookings!inner(occupant_id, booking_ref)')
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'Already processed' }, { status: 409 })
  }

  const booking = Array.isArray(updated.booking) ? updated.booking[0] : (updated.booking as any)

  after(async () => {
    try {
      await dispatchDraftApproved({
        tenantId,
        occupantId: booking.occupant_id,
        amount:     updated.amount,
        bookingId:  updated.booking_id,
        bookingRef: booking.booking_ref,
      })
    } catch (e) { console.error('[bank-draft] approve dispatch', e) }
  })

  return NextResponse.json({ status: 'success' })
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @gh-hostels/web type-check`

Expected: 0 errors.

- [ ] **Step 3: Manual smoke test**

Log in as an owner; copy session cookie. Pick a pending draft id (created in Task 6).

```bash
curl -i -X POST 'http://localhost:3000/api/bank-drafts/<payment_id>/approve' \
  -H 'cookie: <owner-cookie>'
```

Expected: `200`, `{ "status": "success" }`. Verify in psql:

```sql
select status, approved_by, approved_at, paid_at from booking_payments where id = '<payment_id>';
select paid_amount, final_amount from bookings where id = '<booking_id>';
```

Status should be `success`, paid_amount should reflect the payment, journal entry should exist (`select * from journal_entries where source_id = '<payment_id>'`).

Try approving again — expect 409.

- [ ] **Step 4: Commit**

Run:
```bash
git add apps/web/app/api/bank-drafts/\[id\]/approve/route.ts
git commit -m "feat(payments): POST /api/bank-drafts/[id]/approve"
```

---

### Task 13: `POST /api/bank-drafts/[id]/reject`

**Files:**
- Create: `apps/web/app/api/bank-drafts/[id]/reject/route.ts`

- [ ] **Step 1: Write the route**

Create `apps/web/app/api/bank-drafts/[id]/reject/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { dispatchDraftRejected } from '@/lib/bank-draft'

const schema = z.object({ reason: z.string().min(3).max(500) })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const ctx = await requireTenantRole(tenantId, ['owner', 'accountant'])
  if (ctx instanceof NextResponse) return ctx

  const body   = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Reason is required (3-500 chars)' }, { status: 422 })

  const { id } = await params
  const admin  = createAdminClient()

  const { data: updated, error } = await admin
    .from('booking_payments')
    .update({
      status:           'failed',
      rejected_reason:  parsed.data.reason,
      rejected_by:      ctx.userId,
      rejected_at:      new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('method', 'bank_draft')
    .eq('status', 'pending')
    .select('id, amount, booking_id, booking:bookings!inner(occupant_id, booking_ref)')
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'Already processed' }, { status: 409 })
  }

  const booking = Array.isArray(updated.booking) ? updated.booking[0] : (updated.booking as any)

  after(async () => {
    try {
      await dispatchDraftRejected({
        tenantId,
        occupantId: booking.occupant_id,
        amount:     updated.amount,
        bookingId:  updated.booking_id,
        bookingRef: booking.booking_ref,
        reason:     parsed.data.reason,
      })
    } catch (e) { console.error('[bank-draft] reject dispatch', e) }
  })

  return NextResponse.json({ status: 'failed' })
}
```

- [ ] **Step 2: Type-check + smoke test**

Run: `pnpm --filter @gh-hostels/web type-check`. Expected: 0 errors.

Smoke test (with a fresh pending draft):
```bash
curl -i -X POST 'http://localhost:3000/api/bank-drafts/<payment_id>/reject' \
  -H 'cookie: <owner-cookie>' \
  -H 'Content-Type: application/json' \
  -d '{"reason":"Bank statement does not show this deposit"}'
```

Expected: `200`, `{ "status": "failed" }`. Verify in psql the row is `status='failed'` with `rejected_reason` set. Try without a reason → 422.

- [ ] **Step 3: Commit**

Run:
```bash
git add apps/web/app/api/bank-drafts/\[id\]/reject/route.ts
git commit -m "feat(payments): POST /api/bank-drafts/[id]/reject"
```

---

### Task 14: `POST /api/bank-drafts/[id]/undo`

**Files:**
- Create: `apps/web/app/api/bank-drafts/[id]/undo/route.ts`

- [ ] **Step 1: Write the route**

Create `apps/web/app/api/bank-drafts/[id]/undo/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const ctx = await requireTenantRole(tenantId, ['owner', 'accountant'])
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  const admin  = createAdminClient()

  // Server-side window enforcement: only undo within 5 minutes of approval.
  const { data: updated, error } = await admin
    .from('booking_payments')
    .update({
      status:       'pending',
      approved_by:  null,
      approved_at:  null,
      paid_at:      null,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('method', 'bank_draft')
    .eq('status', 'success')
    .gt('approved_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .select('id')
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'Undo window expired' }, { status: 410 })
  }

  return NextResponse.json({ status: 'pending' })
}
```

- [ ] **Step 2: Type-check + smoke test**

Run: `pnpm --filter @gh-hostels/web type-check`. Expected: 0.

Smoke test: approve a draft (Task 12), then within 5 minutes call this endpoint. Expect `200`. Wait 6 minutes, try again → `410`.

- [ ] **Step 3: Commit**

Run:
```bash
git add apps/web/app/api/bank-drafts/\[id\]/undo/route.ts
git commit -m "feat(payments): POST /api/bank-drafts/[id]/undo"
```

---

### Task 15: Admin queue page (server-rendered shell)

**Files:**
- Create: `apps/web/app/(tenant)/payments/drafts/page.tsx`

- [ ] **Step 1: Write the page**

Create `apps/web/app/(tenant)/payments/drafts/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { DraftQueue } from '@/components/payments/draft-queue'

export const metadata: Metadata = { title: 'Bank Drafts · Payments' }
export const dynamic = 'force-dynamic'

export default async function BankDraftsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = await getServerTenantId()
  if (!tenantId) redirect('/dashboard')

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('tenant_members')
    .select('role, is_active')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .single()
  if (!member || !member.is_active || !['owner', 'accountant'].includes(member.role)) {
    redirect('/dashboard')
  }

  // Initial server-rendered queue (the client component will subscribe to realtime updates from here).
  const { data: pending } = await admin
    .from('booking_payments')
    .select(`
      id, amount, draft_number, draft_bank_name, draft_deposit_date, draft_note,
      draft_file_path, created_at,
      booking:bookings!inner(
        id, booking_ref, final_amount, paid_amount,
        occupant:occupants(id, first_name, last_name, phone),
        room:rooms(room_number, block)
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('method', 'bank_draft')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const { data: recentlyProcessed } = await admin
    .from('booking_payments')
    .select(`
      id, amount, status, draft_number, draft_bank_name,
      approved_at, approved_by, rejected_at, rejected_by, rejected_reason, created_at,
      booking:bookings!inner(booking_ref, occupant:occupants(first_name, last_name))
    `)
    .eq('tenant_id', tenantId)
    .eq('method', 'bank_draft')
    .in('status', ['success', 'failed'])
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Bank Drafts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Drafts uploaded by residents awaiting your verification. Updates live.
        </p>
      </header>

      <DraftQueue
        tenantId={tenantId}
        initialPending={pending ?? []}
        initialRecentlyProcessed={recentlyProcessed ?? []}
      />
    </div>
  )
}
```

- [ ] **Step 2: Type-check (expects DraftQueue not yet implemented)**

Skip type-check until Task 16; commit after both tasks together.

---

### Task 16: `DraftQueue` client component (realtime + slide-over orchestrator)

**Files:**
- Create: `apps/web/components/payments/draft-queue.tsx`
- Create: `apps/web/components/payments/draft-review-panel.tsx` (next task — this task creates the queue, the panel is a separate task)

- [ ] **Step 1: Write the queue component**

Create `apps/web/components/payments/draft-queue.tsx`:

```tsx
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { DraftReviewPanel } from './draft-review-panel'

interface PendingRow {
  id:                  string
  amount:              number
  draft_number:        string | null
  draft_bank_name:     string | null
  draft_deposit_date:  string | null
  draft_note:          string | null
  draft_file_path:     string | null
  created_at:          string
  booking: {
    id:           string
    booking_ref:  string
    final_amount: number
    paid_amount:  number
    occupant:     { id: string; first_name: string; last_name: string; phone: string | null } | null
    room:         { room_number: string | null; block: string | null } | null
  }
}

interface ProcessedRow {
  id:               string
  amount:           number
  status:           'success' | 'failed'
  draft_number:     string | null
  draft_bank_name:  string | null
  approved_at:      string | null
  approved_by:      string | null
  rejected_at:      string | null
  rejected_by:      string | null
  rejected_reason:  string | null
  created_at:       string
  booking:          { booking_ref: string; occupant: { first_name: string; last_name: string } | null }
}

interface Props {
  tenantId:                 string
  initialPending:           PendingRow[]
  initialRecentlyProcessed: ProcessedRow[]
}

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}
function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60)        return `${sec}s ago`
  if (sec < 3600)      return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400)     return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}
function isStale(iso: string) {
  return Date.now() - new Date(iso).getTime() > 24 * 60 * 60 * 1000
}

export function DraftQueue({ tenantId, initialPending, initialRecentlyProcessed }: Props) {
  const [pending, setPending] = useState<PendingRow[]>(initialPending)
  const [processed, setProcessed] = useState<ProcessedRow[]>(initialRecentlyProcessed)
  const [showProcessed, setShowProcessed] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reconnecting, setReconnecting] = useState(false)
  const supabaseRef = useRef(createClient())

  const refreshAll = useCallback(async () => {
    const sb = supabaseRef.current
    const { data: fresh } = await sb
      .from('booking_payments')
      .select(`
        id, amount, draft_number, draft_bank_name, draft_deposit_date, draft_note,
        draft_file_path, created_at,
        booking:bookings!inner(
          id, booking_ref, final_amount, paid_amount,
          occupant:occupants(id, first_name, last_name, phone),
          room:rooms(room_number, block)
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('method', 'bank_draft')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    setPending((fresh as unknown as PendingRow[]) ?? [])
  }, [tenantId])

  useEffect(() => {
    const sb = supabaseRef.current
    const channel = sb
      .channel(`tenant-drafts-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'booking_payments',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => { refreshAll() },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED')                setReconnecting(false)
        else if (status === 'CHANNEL_ERROR' ||
                 status === 'TIMED_OUT')            setReconnecting(true)
      })
    return () => { sb.removeChannel(channel) }
  }, [tenantId, refreshAll])

  const selected = pending.find(p => p.id === selectedId) ?? null

  return (
    <div className="relative">
      {reconnecting && (
        <div className="mb-3 rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-800">
          Reconnecting to live updates…
        </div>
      )}

      <p className="mb-3 text-sm text-slate-600">
        <span className="font-semibold text-slate-900">{pending.length}</span> pending · sorted oldest first
      </p>

      {pending.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid grid-cols-[40px_1.6fr_1fr_1fr_1fr_1fr_1.2fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <div></div>
            <div>Resident</div>
            <div>Amount</div>
            <div>Draft #</div>
            <div>Bank</div>
            <div>Deposit date</div>
            <div>Submitted</div>
          </div>

          {pending.map(row => {
            const stale = isStale(row.created_at)
            const occ = row.booking.occupant
            const room = row.booking.room
            return (
              <button
                key={row.id}
                onClick={() => setSelectedId(row.id)}
                className={`grid w-full grid-cols-[40px_1.6fr_1fr_1fr_1fr_1fr_1.2fr] gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-slate-50 ${selectedId === row.id ? 'bg-blue-50' : ''}`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">
                  {(occ?.first_name?.[0] ?? '?')}{(occ?.last_name?.[0] ?? '')}
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{occ?.first_name} {occ?.last_name}</div>
                  <div className="text-[10px] text-slate-400">
                    {room?.room_number ? `Room ${room.room_number}${room.block ? ' · ' + room.block : ''} · ` : ''}{row.booking.booking_ref}
                  </div>
                </div>
                <div className="font-mono font-bold text-slate-900">{ghs(row.amount)}</div>
                <div className="font-mono text-slate-700">{row.draft_number ?? '—'}</div>
                <div className="text-slate-700">{row.draft_bank_name ?? '—'}</div>
                <div className="text-slate-700">{row.draft_deposit_date ?? '—'}</div>
                <div className={`flex items-center gap-1 text-xs ${stale ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                  <Clock className="h-3.5 w-3.5" />
                  {timeAgo(row.created_at)}
                  {stale && <AlertTriangle className="h-3.5 w-3.5" />}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Recently processed */}
      <div className="mt-6">
        <button
          onClick={() => setShowProcessed(s => !s)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-50"
        >
          {showProcessed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Recently processed (last 24h) · {processed.length}
        </button>

        {showProcessed && (
          <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {processed.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No drafts processed yet.</p>
            )}
            {processed.map(p => (
              <div key={p.id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${p.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {p.status === 'success' ? 'Approved' : 'Rejected'}
                </span>
                <span className="font-medium text-slate-800">{p.booking.occupant?.first_name} {p.booking.occupant?.last_name}</span>
                <span className="font-mono text-slate-700">{ghs(p.amount)}</span>
                <span className="text-[10px] text-slate-400">{p.booking.booking_ref}</span>
                {p.status === 'failed' && p.rejected_reason && (
                  <span className="truncate text-[11px] text-red-600" title={p.rejected_reason}>{p.rejected_reason}</span>
                )}
                {p.status === 'success' && p.approved_at && (
                  <UndoLink id={p.id} approvedAt={p.approved_at} onUndo={refreshAll} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <DraftReviewPanel
          row={selected}
          onClose={() => setSelectedId(null)}
          onProcessed={() => { setSelectedId(null); refreshAll() }}
        />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <Clock className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-2 text-sm font-medium text-slate-500">No pending drafts</p>
      <p className="mt-1 text-xs text-slate-400">New uploads will appear here automatically.</p>
    </div>
  )
}

/**
 * 5-minute Undo link. Hides itself client-side once the window expires;
 * the server-side route enforces the same window and returns 410 if abused.
 */
function UndoLink({ id, approvedAt, onUndo }: { id: string; approvedAt: string; onUndo: () => void }) {
  const FIVE_MIN = 5 * 60 * 1000
  const [remaining, setRemaining] = useState(() => Math.max(0, FIVE_MIN - (Date.now() - new Date(approvedAt).getTime())))
  const [busy,      setBusy]      = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    if (remaining <= 0) return
    const t = setInterval(() => {
      setRemaining(r => Math.max(0, r - 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [remaining])

  if (remaining <= 0) return null

  const sec = Math.ceil(remaining / 1000)
  const label = sec >= 60 ? `${Math.ceil(sec / 60)}m` : `${sec}s`

  async function undo() {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/bank-drafts/${id}/undo`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        throw new Error(d?.error ?? 'Undo failed')
      }
      onUndo()
    } catch (e: any) {
      setError(e.message); setBusy(false)
    }
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      {error && <span className="text-[10px] text-red-600">{error}</span>}
      <button
        onClick={undo}
        disabled={busy}
        className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        title={`Undo within ${label}`}
      >
        Undo · {label}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Don't commit yet** — wait for Task 17.

---

### Task 17: `DraftReviewPanel` slide-over

**Files:**
- Create: `apps/web/components/payments/draft-review-panel.tsx`

- [ ] **Step 1: Write the component**

Create `apps/web/components/payments/draft-review-panel.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, AlertTriangle, FileText } from 'lucide-react'

interface Row {
  id:                  string
  amount:              number
  draft_number:        string | null
  draft_bank_name:     string | null
  draft_deposit_date:  string | null
  draft_note:          string | null
  draft_file_path:     string | null
  created_at:          string
  booking: {
    id:           string
    booking_ref:  string
    final_amount: number
    paid_amount:  number
    occupant:     { id: string; first_name: string; last_name: string; phone: string | null } | null
  }
}

interface Props {
  row:         Row
  onClose:     () => void
  onProcessed: () => void
}

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}

export function DraftReviewPanel({ row, onClose, onProcessed }: Props) {
  const [signedUrl, setSignedUrl]     = useState<string | null>(null)
  const [busy,      setBusy]          = useState<'approve' | 'reject' | null>(null)
  const [error,     setError]         = useState<string | null>(null)
  const [rejectMode, setRejectMode]   = useState(false)
  const [reason,    setReason]        = useState('')

  useEffect(() => {
    let cancelled = false
    setSignedUrl(null)
    fetch(`/api/bank-drafts/${row.id}/url`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setSignedUrl(d?.url ?? null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [row.id])

  const balance     = Math.max(0, row.booking.final_amount - row.booking.paid_amount)
  const overpayment = row.amount > balance
  const occ         = row.booking.occupant

  async function approve() {
    setBusy('approve'); setError(null)
    try {
      const res = await fetch(`/api/bank-drafts/${row.id}/approve`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        throw new Error(d?.error ?? 'Approve failed')
      }
      onProcessed()
    } catch (e: any) {
      setError(e.message); setBusy(null)
    }
  }

  async function submitReject() {
    if (reason.trim().length < 3) { setError('Reason is required (min 3 chars)'); return }
    setBusy('reject'); setError(null)
    try {
      const res = await fetch(`/api/bank-drafts/${row.id}/reject`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reason: reason.trim() }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        throw new Error(d?.error ?? 'Reject failed')
      }
      onProcessed()
    } catch (e: any) {
      setError(e.message); setBusy(null)
    }
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-slate-900/30" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[380px] flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-bold text-slate-900">Review draft</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-slate-100"><X className="h-4 w-4 text-slate-500" /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {signedUrl ? (
              row.draft_file_path?.endsWith('.pdf') ? (
                <iframe src={signedUrl} className="h-48 w-full" />
              ) : (
                <a href={signedUrl} target="_blank" rel="noreferrer">
                  <img src={signedUrl} className="h-48 w-full object-cover" alt="Draft" />
                </a>
              )
            ) : (
              <div className="flex h-48 items-center justify-center text-xs text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading preview…
              </div>
            )}
          </div>

          <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Outstanding balance on this booking
            <div className="mt-1 text-base font-bold text-amber-950">{ghs(balance)}</div>
          </div>

          {overpayment && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This will create a credit of {ghs(row.amount - balance)} on the booking.
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3 text-xs">
            <Pair label="Resident"    value={`${occ?.first_name ?? ''} ${occ?.last_name ?? ''}`.trim() || '—'} />
            <Pair label="Booking"     value={row.booking.booking_ref} mono />
            <Pair label="Amount"      value={ghs(row.amount)} mono />
            <Pair label="Draft #"     value={row.draft_number ?? '—'} mono />
            <Pair label="Bank"        value={row.draft_bank_name ?? '—'} />
            <Pair label="Deposit date" value={row.draft_deposit_date ?? '—'} />
          </dl>

          {row.draft_note && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Resident note</p>
              <p className="mt-1 rounded bg-slate-50 px-3 py-2 text-xs text-slate-700">&ldquo;{row.draft_note}&rdquo;</p>
            </div>
          )}

          <p className="mt-4 rounded bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
            Approval marks this payment <strong>success</strong>, updates the booking&apos;s paid amount, and posts a journal entry. Resident receives push + SMS.
          </p>

          {rejectMode && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Rejection reason (required)</p>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                placeholder="e.g. Bank statement does not show this deposit"
              />
            </div>
          )}

          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        </div>

        <footer className="grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          {!rejectMode ? (
            <>
              <button
                onClick={() => setRejectMode(true)}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
              >
                Reject
              </button>
              <button
                onClick={approve}
                disabled={busy === 'approve'}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy === 'approve' && <Loader2 className="h-4 w-4 animate-spin" />}
                ✓ Approve {ghs(row.amount)}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setRejectMode(false); setReason(''); setError(null) }} className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-700">
                Back
              </button>
              <button onClick={submitReject} disabled={busy === 'reject'} className="flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                {busy === 'reject' && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm reject
              </button>
            </>
          )}
        </footer>
      </aside>
    </>
  )
}

function Pair({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-sm font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}
```

- [ ] **Step 2: Add the admin signed-URL route**

Create `apps/web/app/api/bank-drafts/[id]/url/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { getSignedDraftUrl } from '@/lib/bank-draft'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const ctx = await requireTenantRole(tenantId, ['owner', 'accountant'])
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  const admin  = createAdminClient()
  const { data: row } = await admin
    .from('booking_payments')
    .select('draft_file_path')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!row?.draft_file_path) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const url = await getSignedDraftUrl(row.draft_file_path, 600)
  if (!url) return NextResponse.json({ error: 'Could not sign URL' }, { status: 500 })
  return NextResponse.json({ url })
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @gh-hostels/web type-check`

Expected: 0 errors.

- [ ] **Step 4: Manual smoke test of the queue**

Visit `/payments/drafts` as owner. Confirm:
- The pending draft from earlier tasks shows in the queue.
- Click it — slide-over opens with preview, metadata, balance highlight, Approve/Reject buttons.
- Click Approve — panel closes, row disappears, `bookings.paid_amount` updates in DB.
- Open a second browser, upload another draft as the occupant — it appears in the admin queue WITHOUT refresh (realtime).
- Reject one with a 3+ char reason — row appears in "Recently processed".

- [ ] **Step 5: Commit (queue + panel + url route + page)**

Run:
```bash
git add apps/web/app/\(tenant\)/payments/drafts/page.tsx \
        apps/web/components/payments/draft-queue.tsx \
        apps/web/components/payments/draft-review-panel.tsx \
        apps/web/app/api/bank-drafts/\[id\]/url/route.ts
git commit -m "feat(payments): admin /payments/drafts queue with realtime + review panel"
```

---

### Task 18: Sidebar badge

**Files:**
- Create: `apps/web/components/payments/sidebar-draft-badge.tsx`
- Modify: the file that renders the admin sidebar (search for "Payments" link)

- [ ] **Step 1: Find the sidebar file**

Run: `grep -rln "/payments\b" apps/web/components/admin* apps/web/components/sidebar* apps/web/app/(tenant)/layout.tsx 2>/dev/null | head -3`

Use whichever component renders the tenant sidebar nav.

- [ ] **Step 2: Write the badge component**

Create `apps/web/components/payments/sidebar-draft-badge.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props { tenantId: string; initialCount: number }

export function SidebarDraftBadge({ tenantId, initialCount }: Props) {
  const [count, setCount] = useState(initialCount)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const sb = supabaseRef.current
    async function refresh() {
      const { count: c } = await sb
        .from('booking_payments')
        .select('id', { head: true, count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('method', 'bank_draft')
        .eq('status', 'pending')
      setCount(c ?? 0)
    }
    const channel = sb
      .channel(`tenant-drafts-badge-${tenantId}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'booking_payments',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => { refresh() })
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [tenantId])

  if (count === 0) return null
  return (
    <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
      {count}
    </span>
  )
}
```

- [ ] **Step 3: Inject into the sidebar**

In the sidebar component, add a sub-link under "Payments":

```tsx
import { SidebarDraftBadge } from '@/components/payments/sidebar-draft-badge'
// ...
<Link href="/payments/drafts" className="flex items-center justify-between ...">
  <span>Bank drafts</span>
  <SidebarDraftBadge tenantId={tenantId} initialCount={initialDraftCount} />
</Link>
```

In the parent server component / layout that renders the sidebar, fetch the initial count once:

```ts
const { count: initialDraftCount } = await admin
  .from('booking_payments')
  .select('id', { head: true, count: 'exact' })
  .eq('tenant_id', tenantId)
  .eq('method', 'bank_draft')
  .eq('status', 'pending')
```

Pass it to the sidebar component.

If the existing sidebar doesn't already have a "Payments" submenu, add a simple anchor "Bank drafts" under the existing "Payments" link, only visible when `tenant_role` is owner or accountant (use whatever role gating already exists for staff-only links).

- [ ] **Step 4: Type-check + smoke test**

Run: `pnpm --filter @gh-hostels/web type-check`. Expected: 0.

In the browser, ensure the badge appears in the sidebar when there are pending drafts and disappears when there are none, without refresh.

- [ ] **Step 5: Commit**

Run:
```bash
git add apps/web/components/payments/sidebar-draft-badge.tsx \
        <the sidebar file you modified>
git commit -m "feat(payments): sidebar badge for pending bank drafts"
```

---

## Phase 6 — Documentation & polish

### Task 19: Update TESTING.md with bank-draft UAT phase

**Files:**
- Modify: `TESTING.md`

- [ ] **Step 1: Append a new phase section**

Open `TESTING.md`. After the existing phases, add:

```markdown
## Phase N — Bank Draft Submissions

Pre-requisites:
- Migrations 055 + 056 applied.
- Test tenant has bank deposit details saved in `/settings` and "Enabled" toggle ON.
- A test occupant with an active booking that has outstanding balance.
- (Optional) `ARKESEL_API_KEY` set to test SMS; otherwise SMS is no-op'd with a console log.
- (Optional) Push subscription registered for an admin browser to test web push.

### Student side

- [ ] On `/occupant-portal/payments`, the "Pay by bank deposit" card appears below the balance card.
- [ ] Tap to expand: hostel's bank details show; "Copy" buttons work on account number.
- [ ] Submit form requires: file (≤5 MB, PDF/JPG/PNG/HEIC), amount, draft #, bank, deposit date.
- [ ] Reject too-large file (>5 MB) — friendly error, no upload attempted.
- [ ] Reject wrong format (e.g. .docx) — friendly error.
- [ ] Successful submission — section collapses to amber pending card.
- [ ] Pending row also appears in payment history with amber clock pill.
- [ ] "View draft" opens the file in a new tab via signed URL.
- [ ] "Cancel submission" requires double-tap; row + file disappear.
- [ ] Trying to submit a second draft while one is pending — server returns 409.

### Admin side

- [ ] Sidebar shows a red "1" badge next to Bank drafts when a pending draft exists.
- [ ] `/payments/drafts` lists the pending draft with all metadata.
- [ ] Click row → slide-over opens with file preview and balance.
- [ ] Approve — row disappears, `bookings.paid_amount` reflects the payment, journal entry posts.
- [ ] Approve again on the same row → 409 "Already processed".
- [ ] Reject without reason → 422.
- [ ] Reject with reason → row moves to "Recently processed" with red badge + reason.
- [ ] Within 5 min of approval, Undo link reverts the row to pending and decrements paid_amount.
- [ ] After 5 min, Undo returns 410.
- [ ] Stale warning: a row older than 24h shows red "Stale" indicator.

### Realtime

- [ ] Open `/payments/drafts` in two admin browsers. Upload a draft from a third browser as the occupant.
- [ ] Both admin browsers show the new row WITHOUT refresh, within ~1s.
- [ ] First admin clicks Approve. Second admin's view removes the row WITHOUT refresh.
- [ ] Sidebar badge counts decrement in both windows.

### Notifications

- [ ] Web push fires to subscribed admin browsers on upload.
- [ ] (If Arkesel configured) Admin SMS arrives within ~5s of upload.
- [ ] (If Arkesel configured) Student SMS arrives within ~5s of approval.
- [ ] (If Arkesel configured) Student SMS includes rejection reason on reject.
- [ ] Push provider unavailable — upload still succeeds; warning in server logs only.

### Settings interactions

- [ ] Owner sets bank fields, saves. `bank_deposits_enabled` auto-flips to true.
- [ ] Owner toggles "Enabled" off. Student portal: "Pay by bank deposit" card hides immediately on next page load. Existing pending drafts still visible to admin.
- [ ] Non-owner role sees the form as read-only.
```

- [ ] **Step 2: Commit**

Run:
```bash
git add TESTING.md
git commit -m "docs(testing): bank draft UAT phase"
```

---

### Task 20: Update APP_OVERVIEW.md

**Files:**
- Modify: `APP_OVERVIEW.md`

- [ ] **Step 1: Update the Payments section**

Find the existing **Payments** sub-section (under "Core Operations"). Replace its body with:

```markdown
**Payments**
- Record payments against bookings (cash, MoMo, bank transfer, cheque)
- Paystack integration for online card/MoMo payments (resident portal)
- **Bank drafts** — residents upload deposit drafts from the portal; owners/accountants verify in a real-time queue at `/payments/drafts`; approval auto-updates booking balance and posts to the journal
```

In the "Modules Built" → "Resident Portal" section (or equivalent), add a bullet:
```markdown
- Pay by bank deposit — view hostel account details, upload your draft, track verification status
```

- [ ] **Step 2: Commit**

Run:
```bash
git add APP_OVERVIEW.md
git commit -m "docs: bank draft submissions in app overview"
```

---

### Task 21: Final integration smoke test

**Files:** none

- [ ] **Step 1: Walk through the full happy path end-to-end**

In one browser as the owner:
1. `/settings` — confirm bank details are saved and Enabled.
2. `/payments/drafts` — confirm 0 pending.

In a second browser as the occupant:
3. `/occupant-portal/payments` — see balance, expand "Pay by bank deposit", upload a draft.

Back to owner browser:
4. Verify the row appears in `/payments/drafts` within ~1s without refresh.
5. Sidebar badge count goes from 0 → 1.
6. Click the row, click Approve.
7. Verify in psql: `bookings.paid_amount` increased; `journal_entries` has a new row with `source='booking_payment', source_id=<payment_id>`.

Back to occupant browser:
8. Refresh — payment history shows the bank draft as Confirmed (green check). Pending card is gone. Balance card reflects the new paid amount.

- [ ] **Step 2: Walk through the rejection path**

Occupant uploads another draft → Owner rejects with reason → Occupant refreshes → sees red Rejected pill in history with the reason text → can immediately upload a new draft.

- [ ] **Step 3: Walk through Cancel + Undo paths**

Occupant uploads → cancels (twice tap) → row + file gone.
Occupant uploads → owner approves → owner clicks Undo within 5 min → row reverts to pending; paid_amount decrements.

- [ ] **Step 4: If anything misbehaves, file as a follow-up issue**

Don't try to fix in this PR. Document it as "known issue" in the PR description if blocking; otherwise as a follow-up task.

- [ ] **Step 5: No commit needed — this is verification only.**

---

### Task 22: Open the PR

**Files:** none

- [ ] **Step 1: Push the branch**

Run:
```bash
git push -u origin feat/bank-draft-payments
```

- [ ] **Step 2: Open a PR**

Run:
```bash
gh pr create --title "feat: student portal bank draft submissions (sub-project 1 of 4)" --body "$(cat <<'EOF'
## Summary
- Adds bank-draft submission to the resident portal: upload, single-pending-per-booking, file validation
- New `/payments/drafts` admin queue with Supabase realtime, slide-over review panel, undo within 5 min
- Three-channel notifications (in-app realtime + web push + SMS) on upload, approval, and rejection
- Tenant settings block for bank deposit account details (auto-enables when required fields saved)
- 2 schema migrations (055, 056) — additive only; existing Paystack flow untouched

## Spec
`docs/superpowers/specs/2026-05-05-student-portal-payments-bank-draft-design.md`

## Test plan
See `TESTING.md` → **Phase N — Bank Draft Submissions** for the full UAT checklist.
- [ ] Migrations apply cleanly to a fresh DB
- [ ] Student happy path (upload → pending → approve)
- [ ] Student reject path (upload → reject with reason → re-upload)
- [ ] Cancel pending submission (file + row deleted)
- [ ] Realtime: two admin windows see updates without refresh
- [ ] Sidebar badge increments / decrements live
- [ ] Undo within 5 min reverts paid_amount; after 5 min returns 410
- [ ] Single-pending-per-booking enforced (DB unique index)
- [ ] Push + SMS dispatched on all three events (where configured)
EOF
)"
```

- [ ] **Step 3:** Share the returned PR URL.

---

## Self-review notes (for the implementing engineer)

- **No automated tests** are included in this plan because the project has no test framework. Manual UAT in TESTING.md is the formal QA artifact. Adding Vitest is a separate initiative not in scope here.
- **API namespace deviation from spec:** the spec wrote `/api/admin/bank-draft/...` but the codebase convention is `/api/<resource>/...` for tenant staff routes (see `/api/maintenance`, `/api/payments`). This plan uses `/api/bank-drafts/...` to match. Notification dispatch and component contracts are unaffected.
- **The `after()` import:** Next.js 16 exposes `after` from `next/server`. If you hit "after is not exported," fall back to a fire-and-forget IIFE: `(async () => { try { await dispatch...() } catch (e) { console.error(e) } })()`. Don't await it.
- **The recipients query in `dispatchDraftSubmitted`:** the join example is illustrative. Look at how existing code resolves a tenant_member's contact phone (search for `.from('tenant_members')` joined to anything with a phone) and replicate. Fall back to `tenants.contact_phone`.
- **Storage policies** use `storage.foldername(name)[1]` to extract the tenant_id segment. If your Postgres version's `storage` schema lacks that helper, use `split_part(name, '/', 1)` instead.
