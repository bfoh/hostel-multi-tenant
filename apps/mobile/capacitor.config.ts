import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ghhostels.app',
  appName: 'GH Hostels',
  webDir: 'src',
  // Load the live, deployed multi-tenant portal. The portal resolves
  // tenant from JWT claims when hosted at app.gh-hostels.com (see
  // APP_OVERVIEW.md and apps/web/middleware.ts).
  //
  // Cold-launches at `/` — the public marketplace homepage (search hostels,
  // browse listings, "List your hostel free") — not `/login`. A logged-out
  // or first-time user now sees the same marketplace front door as the
  // website. An already-authenticated user is unaffected: `/`'s own
  // `if (user) redirect('/dashboard')` plus middleware.ts's existing
  // role-based redirect chain (owner/staff → /dashboard, occupant →
  // /occupant-portal) fires exactly as it did when this pointed at /login,
  // so returning users still land on their portal, not the marketplace.
  server: {
    url: 'https://app.gh-hostels.com/',
    cleartext: false,
    androidScheme: 'https',
  },
  ios: {
    // 'never': the webview renders truly edge-to-edge and the web pages
    // handle their own safe-area padding via CSS env(safe-area-inset-*)
    // (see app/layout.tsx's viewportFit: 'cover' + the per-page padding
    // fixes). 'always' was stacking a second, native-level inset on top
    // of that CSS padding, shrinking the effective content frame on all
    // four sides and revealing this backgroundColor as a visible border.
    contentInset: 'never',
    backgroundColor: '#ffffff',
  },
  android: {
    backgroundColor: '#ffffff',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#ffffff',
    },
  },
}

export default config
