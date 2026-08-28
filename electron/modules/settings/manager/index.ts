import {
  setSetting as setSettingToDb,
  getAllSettings as getAllSettingsFromDb,
  type SettingItem
} from '../settingsDb'

const settingsCache = new Map<string, string>()

export function syncFromDb(): void {
  settingsCache.clear()
  const records = getAllSettingsFromDb()
  for (const item of records) {
    settingsCache.set(item.key, item.value)
  }
}

export function getSetting(key: string): string | null {
  if (settingsCache.size === 0) {
    syncFromDb()
  }
  return settingsCache.get(key) ?? null
}

export function setSetting(key: string, value: string): void {
  setSettingToDb(key, value)
  settingsCache.set(key, value)
}

export function getAllSettings(): SettingItem[] {
  if (settingsCache.size === 0) {
    syncFromDb()
  }
  return Array.from(settingsCache.entries()).map(([key, value]) => ({ key, value }))
}
