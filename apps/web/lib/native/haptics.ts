'use client'

/**
 * Bridge to the native haptics engine, installed on `window.GHHostelsHaptics`
 * by the Capacitor mobile shell (apps/mobile/src/haptics-bridge.ts).
 *
 * Browsers without the bridge get silent no-ops.
 *
 * Usage:
 *   import { haptics } from '@/lib/native/haptics'
 *   haptics.success()   // after a payment confirms
 *   haptics.medium()    // after a form submit
 *   haptics.light()     // on add-to-cart
 */

declare global {
  interface Window {
    GHHostelsHaptics?: {
      isAvailable: boolean
      light():   Promise<void> | void
      medium():  Promise<void> | void
      heavy():   Promise<void> | void
      success(): Promise<void> | void
      warning(): Promise<void> | void
      error():   Promise<void> | void
    }
  }
}

type HapticFn = () => Promise<void> | void
const noop: HapticFn = () => undefined

function pick(method: keyof NonNullable<Window['GHHostelsHaptics']>): HapticFn {
  if (typeof window === 'undefined') return noop
  const bridge = window.GHHostelsHaptics
  if (!bridge?.isAvailable) return noop
  const fn = bridge[method]
  return typeof fn === 'function' ? (fn as HapticFn) : noop
}

export const haptics = {
  light:   ((): Promise<void> | void => pick('light')()),
  medium:  ((): Promise<void> | void => pick('medium')()),
  heavy:   ((): Promise<void> | void => pick('heavy')()),
  success: ((): Promise<void> | void => pick('success')()),
  warning: ((): Promise<void> | void => pick('warning')()),
  error:   ((): Promise<void> | void => pick('error')()),
}
