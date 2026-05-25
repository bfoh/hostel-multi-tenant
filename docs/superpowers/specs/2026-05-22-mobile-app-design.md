# GH Hostels Mobile App — Design Spec

**Date:** 2026-05-22
**Status:** Approved (brainstorm phase)
**Next:** Implementation plan via `superpowers:writing-plans`

---

## 1. Purpose & Audience

Ship a native Android + iOS mobile app for the GH Hostels multi-tenant SaaS, serving two audiences:

1. **Residents (occupants)** — full mobile version of the existing occupant portal.
2. **Tenant owners** — daily digest only (today + history + push). No drill-down.

Other tenant roles (staff, accountant) are out of scope for v1.

Quality bar: vibrant, sleek, modern, light, premium, professional, highly user-friendly.

---

## 2. Approach

**Capacitor wrap** of the existing Next.js 16 occupant portal, plus a new owner-digest web route. The Capacitor webview loads `app.gh-hostels.com` (the existing multi-tenant app host, which resolves tenant from JWT claims), wrapped in a native shell that adds genuine native capabilities. Single app per platform — themed dynamically per logged-in tenant. Not a per-hostel white-label build (deferred).

Rejected alternatives:
- **Expo / React Native rebuild** — would duplicate UI and double maintenance forever, throwing away the recently-shipped premium portal facelift.
- **PWA / TWA only** — cannot ship to Apple App Store properly; user requires both stores.

---

## 3. Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Native shell  (Capacitor — Swift glue iOS / Kotlin glue   │
│  Android)                                                   │
│  • Splash, status bar, biometric gate                       │
│  • Push token registration (APNs / FCM)                     │
│  • Deep-link router                                         │
│  • Camera, haptics, share, preferences cache                │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────┐
│  Webview → https://app.gh-hostels.com                      │
│  Existing Next.js 16 portal + new /owner-digest route       │
│  Tenant resolved from JWT claims (existing behaviour)       │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────┐
│  Supabase (Postgres + Auth + Storage) + existing API routes │
│  + new /api/push/register + FCM/APNs sender                 │
└────────────────────────────────────────────────────────────┘
```

**Monorepo layout addition:**

```
apps/
  web/        ← existing
  mobile/     ← new Capacitor project (ios/, android/, capacitor.config.ts)
packages/
  ...
```

---

## 4. App Flow & Role Routing

1. Cold start → native splash (cached tenant logo if available, else generic GH Hostels splash).
2. Has stored Supabase session? → biometric prompt (Face ID / Touch ID / Android BiometricPrompt).
3. Webview loads `app.gh-hostels.com`.
4. Portal session resolves user role:
   - **Occupant** → existing `/occupant-portal` (premium, bottom-nav).
   - **`tenant_members.role = 'owner'`** → new `/owner-digest`. (Schema confirmed: `tenant_members.role text check (role in ('owner','admin','manager','accountant','receptionist','member'))`. Only `'owner'` qualifies for v1.)
   - **Other tenant_member roles (staff, accountant, manager, etc.)** → friendly block: "Use desktop dashboard for full features." App is owners + residents only.
5. No session → existing portal login page.

Biometric is a **native gate over an unlocked webview session**, not a re-auth — keeps the design simple and works with Supabase SSR cookies. If the underlying session expires, the webview shows the login page on next load.

---

## 5. Resident Experience

100% reuse of the existing occupant portal — no rebuild. Available screens (already shipped):

- Home (overview, recent activity)
- Payments (Paystack + bank-draft upload)
- Invoices (list + detail + PDF view)
- Messages (realtime DMs, resident-to-resident togglable)
- Notices
- Profile
- Food ordering (menu, cart, orders)
- Maintenance (list, new request, detail)
- Settings (incl. password update)
- Roommate-matching survey + dashboard

Native polish added by the shell:

- Pull-to-refresh (Capacitor bridge to webview)
- Status bar themed to tenant primary color
- Haptic feedback on key actions (submit payment, complete order, send message)
- Native camera replaces the web file picker for ID verification, maintenance issue photos, and bank-draft uploads
- Offline read cache (invoices, notices, last-seen messages) via the existing service worker + Dexie

---

## 6. Owner Experience (new web route)

New route in the portal: **`/owner-digest`** (auth gated to `tenant_members.role = 'owner'`).

Note: a richer `/dashboard/owner` route already exists in the web portal (574 lines, today/yesterday/week/month tabs, full rollups via `lib/reports/daily`). We **do not** route the mobile app to that — per the explicit "only daily digest" scope, the mobile app gets a slim new `/owner-digest` route that reuses the same `lib/reports/daily` data layer but renders only digest content (today's snapshot + history). The full web owner dashboard remains web-only.

**Today view** — renders the latest `tenant_daily_reports` row for the tenant. Schema confirmed (migration `072_tenant_daily_reports.sql`):
- Revenue: `revenue_total`, breakdown (`revenue_rooms`, `revenue_food`, `revenue_pos`, `revenue_walkin`, `revenue_deposits`) and by method (`rev_cash`, `rev_momo`, `rev_card`, `rev_bank`, `rev_online_other`)
- Receivables: `outstanding_balance`, `overdue_installments_count`, `overdue_installments_amount`
- Occupancy: `rooms_total`, `rooms_occupied`, `rooms_reserved`, `rooms_dirty`, `rooms_maintenance`, `occupancy_pct`
- Movement: `arrivals_today`, `departures_today`
- Delta vs. yesterday (via existing `deltaVs()` from `lib/reports/daily`)

Data source: existing `getDailyReport()` from `lib/reports/daily.ts` (already used by `/dashboard/owner` and digest). Render as a clean, read-only screen — no edit, no drill-down.

**History view** — paginated list of the past 90 daily reports via existing `listDailyReports()`. Tap a row to view that day's full snapshot in the same layout as Today.

**Push integration** — when the daily-digest cron sends, it also emits a native push to all owner devices for that tenant. Notification payload carries `{ path: "/owner-digest" }` so the deep-link router opens straight to today's digest.

---

## 7. Native Features (v1)

| Capability     | Plugin / approach                                   | Notes                                                                 |
|----------------|-----------------------------------------------------|-----------------------------------------------------------------------|
| Push           | `@capacitor/push-notifications` + Firebase (FCM)    | FCM HTTP v1 handles both Android (FCM) and iOS (proxied APNs)         |
| Deep links     | `@capacitor/app` URL handler                        | Notification payload `{ path }` → webview loads that path             |
| Biometric      | `capacitor-native-biometric` (or `@aparajita/...`)  | Face ID, Touch ID, Android BiometricPrompt                            |
| Camera         | `@capacitor/camera`                                 | Photo + library; blob piped to existing upload endpoints              |
| Offline        | Existing service worker + Dexie + Capacitor prefs   | Read-only v1 (invoices, notices, cached messages)                     |
| Polish         | `@capacitor/haptics`, `status-bar`, `splash-screen` | Status bar tint + splash use cached tenant color/logo after login     |

---

## 8. Push Migration

Current state: web-push (VAPID) for browsers. Keep it for desktop.

New native track, in parallel:

- New table `device_push_tokens` — columns: `id`, `user_id`, `tenant_id`, `platform` (`ios` | `android`), `token`, `app_version`, `last_seen_at`, `created_at`. Unique on `(user_id, token)`.
- Capacitor registers token on app start (post-login) → `POST /api/push/register` with `{ token, platform, app_version }`.
- Existing notification senders (daily digest, payment receipts, new message, new maintenance request, notice published) fan out to **FCM (Android) + APNs via FCM (iOS) + web-push (browsers)** for the target user.
- Use **FCM HTTP v1** for both platforms — one SDK, one credential, APNs key configured inside Firebase.
- Token cleanup: 410 / `UNREGISTERED` responses delete the row.

---

## 9. Tenant Theming

The web portal already stores `tenants.logo_url` and `tenants.primary_color` per tenant.

- **Pre-login** — generic GH Hostels splash + neutral theme.
- **Post-login** — the portal applies the tenant's brand color throughout the webview UI (existing behaviour). The native shell reads the same two values via a small bootstrap call and:
  - Tints the native status bar (Capacitor `StatusBar.setBackgroundColor` / `setStyle`).
  - Caches logo + color in Capacitor preferences so the *next* cold-launch splash can show the tenant brand instead of the generic splash.

No per-hostel store builds in v1. White-label store apps are explicitly deferred.

---

## 10. Premium UX Standards

- Native splash → app handoff with no white flash.
- Edge-to-edge layout, full safe-area handling (notch, home indicator, gesture areas).
- 60fps webview (WKWebView iOS, modern WebView Android).
- Haptic feedback on submit, success, error.
- Themed status bar matching tenant primary color.
- Native swipe-back gesture on iOS.
- Pull-to-refresh.
- Skeleton loaders on cold load.
- Real native biometric lock screen on launch (not a web modal).

---

## 11. What You Need (Accounts, Tools, Costs)

| Item                                     | Cost                          | Why                                            |
|------------------------------------------|-------------------------------|------------------------------------------------|
| Apple Developer Program                  | $99 / year                    | iOS App Store, TestFlight, APNs key            |
| Google Play Developer account            | $25 one-time                  | Play Store, internal testing tracks            |
| Mac with Xcode (latest)                  | $0 (existing macOS)           | iOS builds + submission require macOS          |
| Android Studio                           | $0                            | Android builds, emulator, signing              |
| Firebase project                         | $0 (free tier sufficient)     | FCM for Android + iOS push                     |
| App icon 1024×1024                       | designer or generated         | Required store asset, both platforms           |
| Splash screen artwork                    | designer or generated         | Required iOS + Android                         |
| Capacitor + plugins                      | $0 (npm)                      | Native bridge + plugin ecosystem               |
| Code-signing certificates                | included with dev accounts    | Required to ship                               |
| Privacy policy URL                       | $0                            | Required by both stores                        |
| App Store screenshots (6.7", 6.5", 5.5") | designer                      | Required submission asset                      |
| Google Play feature graphic + screenshots | designer                     | Required submission asset                      |

Existing skills cover most of the build (Next.js + Supabase). New skills needed: Capacitor (small JS learning curve), basic Xcode + Android Studio config for signing.

---

## 12. Build Phases

Detailed task-level plan to be produced by `superpowers:writing-plans` after this design is accepted. High-level phases:

1. **Phase 0 — Accounts + Firebase + visual assets**
   Set up Apple Developer, Google Play, Firebase project, generate app icon + splash.
2. **Phase 1 — Capacitor scaffold**
   Create `apps/mobile`, wrap `app.gh-hostels.com`, runs on iOS simulator + Android emulator + physical device.
3. **Phase 2 — Native push + device-token table + deep links**
   `device_push_tokens` migration, `/api/push/register` endpoint, FCM integration in sender services, deep-link routing in shell.
4. **Phase 3 — Biometric + camera + offline read cache**
   Biometric gate, native camera plugin replacing file pickers for the three upload paths, offline cache verification.
5. **Phase 4 — `/owner-digest` web route + role-based routing**
   New web route (today + history), reuse digest data layer, shell directs owners there post-login.
6. **Phase 5 — Theming, splash, status bar, haptics, store assets**
   Tenant theming bootstrap, premium polish, all store screenshots + descriptions.
7. **Phase 6 — TestFlight + Play internal testing → production submission**
   Beta on both platforms, fix review feedback, submit for production.

---

## 13. Out of Scope (v1)

- Per-hostel white-label store apps (deferred — single themed app only).
- Owner drill-downs beyond the digest.
- Offline writes (read-only cache only).
- Tablet-optimised layouts.
- Staff portal in the mobile app.
- In-app purchases / Apple billing (Paystack stays in-webview — rent is a service payment, not digital goods, safe under Apple 3.1.1).
- Over-the-air (OTA) update service (Appflow / similar) — skip for v1; ship store builds.
- Push to non-owner tenant_member roles.

---

## 14. Risks & Mitigations

| Risk                                                    | Mitigation                                                                 |
|---------------------------------------------------------|----------------------------------------------------------------------------|
| Apple guideline 4.2 ("minimum functionality" web wrap)  | Ship four genuine native capabilities (push, biometric, camera, deep links). Justify native value in submission notes. |
| Apple 3.1.1 (in-app purchase requirement)               | Paystack flow is for rent (service payment), not digital goods. Documented in submission notes. |
| Supabase SSR cookies inside Capacitor webview           | Capacitor webview behaves like a browser — cookies persist. Verify in Phase 1. |
| APNs / FCM credential rotation                          | Use APNs key model (not p12 cert) — long-lived, low ops.                   |
| Tenant resolution inside the app                        | `app.gh-hostels.com` already resolves tenant from JWT claims per `APP_OVERVIEW.md`. No new code. |
| Webview performance regressions                         | Test on low-end Android (existing target market). Use native splash to mask any cold-load latency. |
| iOS App Store review delays (1–7 days per attempt)      | Use TestFlight for iteration. Submit early; budget two review cycles before public launch. |

---

## 15. Success Criteria

- App listed and live on Apple App Store and Google Play under one listing each.
- Resident can log in, complete a payment, submit a maintenance request with a photo from native camera, and receive a push notification when a notice is posted — all from the app.
- Owner can log in, see today's digest, browse 30+ days of digest history, and receive a daily push that deep-links to today's digest.
- Biometric unlock works on iOS (Face ID / Touch ID) and Android (BiometricPrompt).
- Tenant theming (logo + primary color) applies after login and persists to next cold launch.
- App passes Apple review with no 4.2 / 3.1.1 rejection.
