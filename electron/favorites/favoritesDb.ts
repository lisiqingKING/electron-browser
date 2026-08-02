import { getDatabase } from '../database/index'

// ============ 收藏 DAO 层 ============
// 数据访问层，负责数据库 CRUD 操作，不涉及业务逻辑和缓存

export interface FavoriteItem {
  id: number
  url: string
  title: string
  favicon?: string
  createdAt: number
}

// 获取所有收藏
export function getAllFavorites(): FavoriteItem[] {
  const stmt = getDatabase().prepare('SELECT id, url, title, favicon, createdAt FROM favorites ORDER BY createdAt DESC')
  return stmt.all() as FavoriteItem[]
}

// 添加收藏
export function addFavorite(url: string, title: string, favicon?: string): number {
  const stmt = getDatabase().prepare('INSERT OR IGNORE INTO favorites (url, title, favicon, createdAt) VALUES (?, ?, ?, ?)')
  const result = stmt.run(url, title, favicon || null, Date.now())
  return result.lastInsertRowid as number
}

// 删除收藏（通过 url）
export function removeFavorite(url: string): void {
  const stmt = getDatabase().prepare('DELETE FROM favorites WHERE url = ?')
  stmt.run(url)
}

// 检查是否已收藏
export function isFavorited(url: string): boolean {
  const stmt = getDatabase().prepare('SELECT 1 FROM favorites WHERE url = ? LIMIT 1')
  return stmt.get(url) !== undefined
}
