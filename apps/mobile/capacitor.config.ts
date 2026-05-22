import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ghhostels.app',
  appName: 'GH Hostels',
  webDir: 'src',
  // Load the live, deployed multi-tenant portal. The portal resolves
  // tenant from JWT claims when hosted at app.gh-hostels.com (see
  // APP_OVERVIEW.md and apps/web/middleware.ts).
  server: {
    url: 'https://app.gh-hostels.com',
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
