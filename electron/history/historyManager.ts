import {
  getAllHistory as getAllHistoryFromDb,
  addHistory as addHistoryToDb,
  deleteHistoryById as deleteHistoryByIdFromDb,
  clearAll as clearAllFromDb,
  trimHistory as trimHistoryFromDb,
  type HistoryItem
} from './historyDb'

// ============ 历史记录 Manager 层 ============
// 门面层，管理内存缓存，调用 DAO 层

// 内存缓存: HistoryItem[]
const historyCache: HistoryItem[] = []

// 同步数据库到内存
export function syncFromDb(): void {
  historyCache.length = 0
  const records = getAllHistoryFromDb()
  historyCache.push(...records)
}

// 获取所有历史记录
export function getHistory(): HistoryItem[] {
  if (historyCache.length === 0) {
    syncFromDb()
  }
  return [...historyCache]
}

// 记录访问
export function recordVisit(title: string, url: string): void {
  const visitedAt = Date.now()

  // 添加到数据库
  const id = addHistoryToDb({ title, url, visitedAt })

  // 添加到内存缓存开头
  historyCache.unshift({ id, title, url, visitedAt })

  // 限制最多 100 条
  if (historyCache.length > 100) {
    historyCache.splice(100)
    trimHistoryFromDb(100)
  }
}

// 删除单条记录（通过 id）
export function deleteRecord(id: number): void {
  const index = historyCache.findIndex(item => item.id === id)
  if (index !== -1) {
    historyCache.splice(index, 1)
    deleteHistoryByIdFromDb(id)
  }
}

// 清空所有历史
export function clearAllHistory(): void {
  historyCache.length = 0
  clearAllFromDb()
}
