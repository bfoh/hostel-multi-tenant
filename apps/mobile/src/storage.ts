import { Preferences } from '@capacitor/preferences'

export const KEYS = {
  TENANT_LOGO_URL:      'tenant_logo_url',
  TENANT_PRIMARY_COLOR: 'tenant_primary_color',
  TENANT_NAME:          'tenant_name',
  PUSH_TOKEN:           'push_token',
} as const

export type StorageKey = (typeof KEYS)[keyof typeof KEYS]

export async function getPref(key: StorageKey): Promise<string | null> {
  const { value } = await Preferences.get({ key })
  return value
}

export async function setPref(key: StorageKey, value: string): Promise<void> {
  await Preferences.set({ key, value })
}

export async function removePref(key: StorageKey): Promise<void> {
  await Preferences.remove({ key })
}
