import { getDatabase } from './database'

let tableChecked = false

function ensureCacheTable(): void {
  if (tableChecked) return
  getDatabase().exec('CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
  tableChecked = true
}

export function getCache(key: string): string | null {
  ensureCacheTable()
  const row = getDatabase()
    .prepare('SELECT value FROM cache WHERE key = ?')
    .get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setCache(key: string, value: string): void {
  ensureCacheTable()
  getDatabase()
    .prepare('INSERT OR REPLACE INTO cache (key, value) VALUES (?, ?)')
    .run(key, value)
}

export function deleteCache(key: string): void {
  ensureCacheTable()
  getDatabase()
    .prepare('DELETE FROM cache WHERE key = ?')
    .run(key)
}
