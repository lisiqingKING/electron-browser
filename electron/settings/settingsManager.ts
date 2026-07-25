import {
  getSetting as getSettingFromDb,
  setSetting as setSettingToDb,
  getAllSettings as getAllSettingsFromDb,
  type SettingItem
} from './settingsDb'

// 内存缓存
const settingsCache = new Map<string, string>()

// 同步数据库到内存
export function syncFromDb(): void {
  settingsCache.clear()
  const records = getAllSettingsFromDb()
  for (const item of records) {
    settingsCache.set(item.key, item.value)
  }
}

// 获取单个设置
export function getSetting(key: string): string | null {
  if (settingsCache.size === 0) {
    syncFromDb()
  }
  return settingsCache.get(key) ?? null
}

// 设置单个值
export function setSetting(key: string, value: string): void {
  settingsCache.set(key, value)
  setSettingToDb(key, value)
}

// 获取所有设置
export function getAllSettings(): SettingItem[] {
  if (settingsCache.size === 0) {
    syncFromDb()
  }
  return Array.from(settingsCache.entries()).map(([key, value]) => ({ key, value }))
}
