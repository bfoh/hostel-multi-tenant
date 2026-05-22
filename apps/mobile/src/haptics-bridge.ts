import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { Capacitor } from '@capacitor/core'

/**
 * Install `window.GHHostelsHaptics` so the portal can trigger haptic
 * feedback (success on payment, light on add-to-cart, etc.) without
 * importing Capacitor itself.
 */
export function setupHapticsBridge(): void {
  if (!Capacitor.isNativePlatform()) return
  ;(window as any).GHHostelsHaptics = {
    isAvailable: true,
    light:   () => Haptics.impact({ style: ImpactStyle.Light  }).catch(() => undefined),
    medium:  () => Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined),
    heavy:   () => Haptics.impact({ style: ImpactStyle.Heavy  }).catch(() => undefined),
    success: () => Haptics.notification({ type: NotificationType.Success }).catch(() => undefined),
    warning: () => Haptics.notification({ type: NotificationType.Warning }).catch(() => undefined),
    error:   () => Haptics.notification({ type: NotificationType.Error   }).catch(() => undefined),
  }
}
