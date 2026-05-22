# Store Submission — GH Hostels Mobile

Reference document for App Store Connect and Google Play Console
submissions. Update version + build numbers per release.

## Identity

| Field             | Value                |
|-------------------|----------------------|
| App name          | GH Hostels           |
| iOS bundle ID     | `com.ghhostels.app`  |
| Android package   | `com.ghhostels.app`  |
| App category      | Business             |
| Age rating        | 4+ / Everyone        |
| Primary contact   | privacy@gh-hostels.com |
| Privacy URL       | (publish `docs/mobile/privacy-policy.md` at a stable URL — e.g. `https://gh-hostels.com/privacy`) |
| Support URL       | https://gh-hostels.com/support |

## Apple App Store

### Native features (justify guideline 4.2 "Minimum Functionality")

The app provides native functionality beyond a web view:

1. **Push notifications via APNs** — daily digest for owners, payment /
   message / notice / maintenance alerts for residents. (`@capacitor/push-notifications`
   + Firebase Cloud Messaging proxying APNs.)
2. **Biometric authentication** (Face ID, Touch ID) — secures the app
   on launch via `capacitor-native-biometric`.
3. **Native camera capture** — bank-draft uploads use the native camera
   bridge installed on `window.GHHostelsCamera`; the user can pick
   between camera and library.
4. **Native splash + tenant-aware status bar tinting** — the status bar
   tints to the logged-in hostel's brand color, cached for next cold
   launch so the splash → app handoff stays on-brand.

### Guideline 3.1.1 (in-app purchase)

The app processes rent and food-order payments through the in-portal
Paystack flow. These are service payments (rent, prepared meals) — not
digital goods or app functionality unlocks — and are exempt from Apple's
in-app purchase requirement per guideline 3.1.3(a) (reader apps / physical
goods and services). Note this explicitly in App Store Connect review
notes.

### Review notes template

> GH Hostels is a multi-tenant operations app for student hostels in
> Ghana. Residents use the app to view their booking, pay rent, order
> food, submit maintenance requests, and chat with their hostel. Tenant
> owners use the app to receive the daily operations digest by push and
> review the last 90 days of digests.
>
> Demo account: <email> / <password> (linked to the seeded review
> tenant). The app does not collect data without an account.
>
> Payments go through Paystack for service payments (rent + food orders).
> Per guideline 3.1.3(a), physical-goods/service payments are exempt
> from the in-app purchase requirement.

### Screenshots required (App Store Connect)

| Display              | Resolution    | Min. count |
|----------------------|---------------|------------|
| 6.7" (iPhone 15 Pro Max) | 1290 × 2796 | 3 |
| 6.5" (iPhone 11 Pro Max) | 1242 × 2688 | 3 |
| 5.5" (iPhone 8 Plus)     | 1242 × 2208 | 3 |

Recommended subjects: occupant home, payment screen, food cart, owner
digest today view, owner digest history.

## Google Play

### Data safety form

| Category               | Collected | Shared | Purpose                     |
|------------------------|-----------|--------|-----------------------------|
| Email address          | Yes       | No     | Account                     |
| Name                   | Yes       | No     | Account                     |
| Photos                 | Yes       | No     | Uploaded by user (drafts)   |
| Payments — purchase history | Yes  | No     | Rent + food orders          |
| Device IDs — FCM token | Yes       | No     | Push notifications          |

All data encrypted in transit. Users can request deletion via the in-app
profile screen or by emailing privacy@gh-hostels.com.

### Screenshots required (Play Console)

| Device         | Resolution    | Min. count |
|----------------|---------------|------------|
| Phone          | 1080 × 1920+  | 2          |
| 7" tablet      | 1024 × 600+   | optional   |
| 10" tablet     | 1280 × 800+   | optional   |
| Feature graphic | 1024 × 500   | 1          |

## Pre-submission checklist

- [ ] Apple Developer Program active (Phase 0.1)
- [ ] Google Play Developer account active (Phase 0.2)
- [ ] Privacy policy URL live and accessible
- [ ] Firebase project configured; `GoogleService-Info.plist` in `apps/mobile/ios/App/App/`
- [ ] `google-services.json` in `apps/mobile/android/app/`
- [ ] APNs key uploaded to Firebase project
- [ ] App icon 1024×1024 (no alpha for iOS) generated to native projects via `npx capacitor-assets generate`
- [ ] Splash 2732×2732 generated to native projects
- [ ] Xcode signing team set on `apps/mobile/ios/App/App.xcworkspace`
- [ ] Push Notifications capability enabled in Xcode
- [ ] Bundle ID `com.ghhostels.app` reserved in App Store Connect
- [ ] Package `com.ghhostels.app` reserved in Play Console
- [ ] `apps/mobile/android/release.keystore` generated (Android Studio → Build → Generate Signed Bundle)
- [ ] `device_push_tokens` migration (096) applied to production Supabase
- [ ] `FCM_PROJECT_ID` + `FCM_SERVICE_ACCOUNT_JSON` env vars set on Vercel
- [ ] App.gh-hostels.com tested in webview via TestFlight + Play internal track

## Release steps

### iOS

1. Bump version (e.g. `0.1.0`) and build number in Xcode → General.
2. Product → Archive.
3. Distribute App → App Store Connect → Upload.
4. App Store Connect → TestFlight → add internal testers.
5. After QA: Submit for Review with notes above.

### Android

1. Bump `versionName` + `versionCode` in `apps/mobile/android/app/build.gradle`.
2. Android Studio → Build → Generate Signed App Bundle → Release → AAB.
3. Play Console → Internal testing → upload AAB, add testers.
4. After QA: Promote release to Production.
