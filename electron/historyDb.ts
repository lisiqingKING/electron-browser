import { getDatabase } from './database'

// ============ 历史记录操作 ============

export interface HistoryRecord {
  id: number
  tabId: string
  title: string
  url: string
  visitedAt: number
}

export function addHistory(tabId: string, title: string, url: string): void {
  const stmt = getDatabase().prepare(
    'INSERT INTO history (tabId, title, url, visitedAt) VALUES (?, ?, ?, ?)'
  )
  stmt.run(tabId, title, url, Date.now())
}

export function getHistoryByTab(tabId: string, limit = 100): HistoryRecord[] {
  const stmt = getDatabase().prepare(
    'SELECT * FROM history WHERE tabId = ? ORDER BY visitedAt DESC LIMIT ?'
  )
  return stmt.all(tabId, limit) as HistoryRecord[]
}

export function getAllHistory(limit = 100): HistoryRecord[] {
  const stmt = getDatabase().prepare(
    'SELECT * FROM history ORDER BY visitedAt DESC LIMIT ?'
  )
  return stmt.all(limit) as HistoryRecord[]
}

export function deleteHistory(id: number): void {
  const stmt = getDatabase().prepare('DELETE FROM history WHERE id = ?')
  stmt.run(id)
}

export function clearHistoryByTab(tabId: string): void {
  const stmt = getDatabase().prepare('DELETE FROM history WHERE tabId = ?')
  stmt.run(tabId)
}

export function clearAllHistory(): void {
  getDatabase().exec('DELETE FROM history')
}
