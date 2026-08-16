import { getDatabase } from '../../shared/database'

// ============ 历史记录 DAO 层 ============
// 数据访问层，负责数据库 CRUD 操作，不涉及业务逻辑和缓存

export interface HistoryItem {
  id: number
  title: string
  url: string
  visitedAt: number
  favicon?: string
}

// 获取所有历史记录（按时间倒序）
export function getAllHistory(): HistoryItem[] {
  const stmt = getDatabase().prepare('SELECT id, title, url, visitedAt, favicon FROM history ORDER BY visitedAt DESC')
  return stmt.all() as HistoryItem[]
}

// 添加单条历史记录
export function addHistory(item: Omit<HistoryItem, 'id'>): number {
  const stmt = getDatabase().prepare('INSERT INTO history (title, url, visitedAt, favicon) VALUES (?, ?, ?, ?)')
  const result = stmt.run(item.title, item.url, item.visitedAt, item.favicon || null)
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

// 查询最近一条指定 URL 的记录
export function findHistoryByUrl(url: string): HistoryItem | undefined {
  const stmt = getDatabase().prepare(
    'SELECT id, title, url, visitedAt, favicon FROM history WHERE url = ? ORDER BY id DESC LIMIT 1'
  )
  return stmt.get(url) as HistoryItem | undefined
}

// 更新已有记录的 visitedAt
export function updateVisitedAt(id: number, visitedAt: number, title?: string, favicon?: string): void {
  if (title !== undefined || favicon !== undefined) {
    const sets: string[] = ['visitedAt = ?']
    const params: (string | number)[] = [visitedAt]
    if (title !== undefined) { sets.push('title = ?'); params.push(title) }
    if (favicon !== undefined) { sets.push('favicon = ?'); params.push(favicon) }
    params.push(id)
    getDatabase().prepare(`UPDATE history SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  } else {
    getDatabase().prepare('UPDATE history SET visitedAt = ? WHERE id = ?').run(visitedAt, id)
  }
}

// 限制历史记录数量（保留最近 N 条）
export function trimHistory(keepCount: number): void {
  getDatabase().exec(`DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY visitedAt DESC LIMIT ${keepCount})`)
}

// 根据 URL 更新最近一条历史记录的 favicon
export function updateFaviconByUrl(url: string, favicon: string): void {
  getDatabase().prepare(
    'UPDATE history SET favicon = ? WHERE url = ? AND id = (SELECT id FROM history WHERE url = ? ORDER BY id DESC LIMIT 1)'
  ).run(favicon, url, url)
}
