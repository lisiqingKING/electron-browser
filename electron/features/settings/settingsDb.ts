import { getDatabase } from '../../shared/database'

export interface SettingItem {
  key: string
  value: string
}

export function getSetting(key: string): string | null {
  const stmt = getDatabase().prepare('SELECT value FROM settings WHERE key = ?')
  const row = stmt.get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  const stmt = getDatabase().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  stmt.run(key, value)
}

export function getAllSettings(): SettingItem[] {
  const stmt = getDatabase().prepare('SELECT key, value FROM settings')
  return stmt.all() as SettingItem[]
}
