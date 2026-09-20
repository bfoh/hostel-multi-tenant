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
    url: 'https://app.gh-hostels.com/login',
    cleartext: false,
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
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
