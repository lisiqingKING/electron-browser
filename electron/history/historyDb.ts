import { getDatabase } from '../database/index'

// ============ 历史记录 DAO 层 ============
// 数据访问层，负责数据库 CRUD 操作，不涉及业务逻辑和缓存

export interface HistoryItem {
  id: number
  title: string
  url: string
  visitedAt: number
}

// 获取所有历史记录（按时间倒序）
export function getAllHistory(): HistoryItem[] {
  const stmt = getDatabase().prepare('SELECT id, title, url, visitedAt FROM history ORDER BY visitedAt DESC')
  return stmt.all() as HistoryItem[]
}

// 添加单条历史记录
export function addHistory(item: Omit<HistoryItem, 'id'>): number {
  const stmt = getDatabase().prepare('INSERT INTO history (title, url, visitedAt) VALUES (?, ?, ?)')
  const result = stmt.run(item.title, item.url, item.visitedAt)
  return result.lastInsertRowid as number
}

// 删除单条历史记录（通过 id）
export function deleteHistoryById(id: number): void {
  const stmt = getDatabase().prepare('DELETE FROM history WHERE id = ?')
  stmt.run(id)
}

// 清空所有历史记录
export function clearAll(): void {
  getDatabase().exec('DELETE FROM history')
}

// 限制历史记录数量（保留最近 N 条）
export function trimHistory(keepCount: number): void {
  getDatabase().exec(`DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY visitedAt DESC LIMIT ${keepCount})`)
}
