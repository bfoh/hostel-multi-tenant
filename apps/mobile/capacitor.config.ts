import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ghhostels.app',
  appName: 'GH Hostels',
  webDir: 'src',
  // Load the live, deployed multi-tenant portal. The portal resolves
  // tenant from JWT claims when hosted at app.gh-hostels.com (see
  // APP_OVERVIEW.md and apps/web/middleware.ts).
  //
  // Cold-launches at /login, not the bare root domain: `/` renders the
  // public SaaS marketing homepage ("Start a 30-day free trial") aimed at
  // prospective hostel operators, not the students/owners who already
  // have an account and just installed this app. If a session is already
  // persisted from a previous login, middleware.ts's own auth-path
  // handling immediately redirects an authenticated visit to /login
  // onward to /occupant-portal or /dashboard anyway, so this is safe for
  // both fresh and returning users.
  server: {
    // TEMPORARY diagnostic query param — do not commit this line.
    url: 'https://app.gh-hostels.com/login?viewportdebug=1',
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
