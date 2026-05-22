import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'
import { log } from './log'

/**
 * Expose a native camera API on `window.GHHostelsCamera` so the
 * webview-hosted portal can call it. Portal components feature-detect
 * `window.GHHostelsCamera?.isAvailable` and call `takePhoto()` instead
 * of using <input type="file" capture>.
 */
export function setupCameraBridge(): void {
  if (!Capacitor.isNativePlatform()) return

  ;(window as any).GHHostelsCamera = {
    isAvailable: true,
    async takePhoto(): Promise<{ dataUrl: string; format: string } | null> {
      try {
        const photo = await Camera.getPhoto({
          quality:      80,
          allowEditing: false,
          resultType:   CameraResultType.DataUrl,
          source:       CameraSource.Prompt, // user picks camera or library
        })
        return { dataUrl: photo.dataUrl ?? '', format: photo.format }
      } catch (err) {
        log.warn('camera: cancelled or failed', { err: String(err) })
        return null
      }
    },
  }

  log.info('camera: bridge installed on window.GHHostelsCamera')
}
