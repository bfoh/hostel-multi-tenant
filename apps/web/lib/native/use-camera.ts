'use client'

/**
 * Bridge to the native camera, installed on `window.GHHostelsCamera`
 * by the Capacitor mobile shell (apps/mobile/src/camera-bridge.ts).
 *
 * Browsers without the bridge get `{ isNative: false, takePhoto: noop }`
 * — callers should keep the existing <input type="file"> fallback.
 */

declare global {
  interface Window {
    GHHostelsCamera?: {
      isAvailable: boolean
      takePhoto(): Promise<{ dataUrl: string; format: string } | null>
    }
  }
}

export function useNativeCamera() {
  const isNative = typeof window !== 'undefined' && !!window.GHHostelsCamera?.isAvailable

  async function takePhoto(): Promise<File | null> {
    if (typeof window === 'undefined' || !window.GHHostelsCamera) return null
    const res = await window.GHHostelsCamera.takePhoto()
    if (!res?.dataUrl) return null
    const blob = await (await fetch(res.dataUrl)).blob()
    const ext = res.format || 'jpeg'
    return new File([blob], `photo-${Date.now()}.${ext}`, { type: blob.type || `image/${ext}` })
  }

  return { isNative, takePhoto }
}
