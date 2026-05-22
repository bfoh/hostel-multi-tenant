# @gh-hostels/mobile

Capacitor native shell wrapping the GH Hostels portal at https://app.gh-hostels.com.

## First-time setup

```bash
npm install                     # installs deps for this workspace (from repo root)
npx cap add ios                 # only first time (or after deleting ios/)
npx cap add android             # only first time (or after deleting android/)
npm run sync                    # build src/main.js + cap sync
```

## Run on iOS simulator

Requires Xcode (15+).

```bash
npm run ios
```

## Run on Android emulator

Requires Android Studio with at least one AVD created.

```bash
npm run android
```

## Open native projects

```bash
npm run open:ios       # opens Xcode
npm run open:android   # opens Android Studio
```

## What's where

- `capacitor.config.ts` — bundle ID, splash/status-bar defaults, **`server.url` points at `app.gh-hostels.com`** (the multi-tenant portal host that resolves tenant from JWT)
- `src/main.ts` — cold-start bootstrap: cached theme → biometric gate → camera/haptics bridges → deep-link router → push registration → role-based webview routing → fresh theme refresh
- `src/push.ts` — `@capacitor/push-notifications` registration + `POST /api/push/register`
- `src/biometric.ts` — Face ID / fingerprint gate (`capacitor-native-biometric`)
- `src/camera-bridge.ts` — exposes `window.GHHostelsCamera` to the webview
- `src/haptics-bridge.ts` — exposes `window.GHHostelsHaptics` to the webview
- `src/theming.ts` — tenant-aware status-bar tint, cached for next cold launch
- `src/deep-links.ts` — `window.location.assign` based webview navigation
- `src/storage.ts` — typed `@capacitor/preferences` wrapper

## Where things live in the wider repo

- New web routes for the mobile app: `apps/web/app/(tenant)/owner-digest/`
- New web APIs the mobile shell calls: `apps/web/app/api/push/`, `apps/web/app/api/mobile/`
- Native push fanout: `apps/web/lib/push/`
- Device-token table: `supabase/migrations/20240001000096_device_push_tokens.sql`
