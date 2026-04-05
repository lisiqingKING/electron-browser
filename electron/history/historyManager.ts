import {
  getAllHistory as getAllHistoryFromDb,
  saveHistory as saveHistoryToDb,
  clearAll as clearAllFromDb,
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
  // 添加新记录到开头
  historyCache.unshift({
    title,
    url,
    visitedAt: Date.now()
  })

  // 限制最多 100 条
  if (historyCache.length > 100) {
    historyCache.length = 100
  }

  // 持久化到数据库
  saveHistoryToDb(historyCache)
}

// 删除单条记录（通过 url + visitedAt 定位）
export function deleteRecord(url: string, visitedAt: number): void {
  const index = historyCache.findIndex(
    item => item.url === url && item.visitedAt === visitedAt
  )
  if (index !== -1) {
    historyCache.splice(index, 1)
    saveHistoryToDb(historyCache)
  }
}

// 清空所有历史
export function clearAllHistory(): void {
  historyCache.length = 0
  clearAllFromDb()
}
