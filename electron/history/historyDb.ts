import { getDatabase } from '../database/index'

// ============ 历史记录 DAO 层 ============
// 数据访问层，负责数据库 CRUD 操作，不涉及业务逻辑和缓存

export interface HistoryItem {
  title: string
  url: string
  visitedAt: number
}

// 获取所有历史记录
export function getAllHistory(): HistoryItem[] {
  const stmt = getDatabase().prepare('SELECT data FROM history LIMIT 1')
  const row = stmt.get() as { data: string } | undefined
  if (!row) return []
  return JSON.parse(row.data)
}

// 保存所有历史记录
export function saveHistory(data: HistoryItem[]): void {
  // 先清空再插入（简化逻辑）
  getDatabase().exec('DELETE FROM history')
  const stmt = getDatabase().prepare('INSERT INTO history (data, updatedAt) VALUES (?, ?)')
  stmt.run(JSON.stringify(data), Date.now())
}

// 清空所有历史记录
export function clearAll(): void {
  getDatabase().exec('DELETE FROM history')
}
