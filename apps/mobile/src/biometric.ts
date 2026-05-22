import { Capacitor } from '@capacitor/core'
import { NativeBiometric, BiometryType } from 'capacitor-native-biometric'
import { log } from './log'

/**
 * Native gate over the webview at cold-start.
 *
 * We do NOT store credentials — we gate app *entry*. The webview holds
 * the Supabase SSR session via cookies; if the session is valid the
 * biometric unlock simply reveals the already-authenticated portal.
 * If the session expired, the portal login page renders after unlock.
 *
 * Returns:
 *   - 'unlocked' on success
 *   - 'skipped'  on non-native platforms or no biometric enrolment
 *   - 'failed'   on user cancel / lockout — caller may continue (webview
 *                will still ask for password login if session is dead)
 */
export async function gateBiometric(): Promise<'unlocked' | 'skipped' | 'failed'> {
  if (!Capacitor.isNativePlatform()) return 'skipped'

  try {
    const available = await NativeBiometric.isAvailable()
    if (!available.isAvailable) {
      log.info('biometric: unavailable', { available })
      return 'skipped'
    }

    await NativeBiometric.verifyIdentity({
      reason:      'Unlock GH Hostels',
      title:       'Unlock',
      subtitle:    'Use your biometric to continue',
      description: '',
    })

    log.info('biometric: unlocked', { type: BiometryType[available.biometryType] })
    return 'unlocked'
  } catch (err) {
    log.warn('biometric: failed', { err: String(err) })
    return 'failed'
  }
}
