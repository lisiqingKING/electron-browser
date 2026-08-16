import {
  getAllHistory as getAllHistoryFromDb,
  addHistory as addHistoryToDb,
  deleteHistoryById as deleteHistoryIdFromDb,
  clearAll as clearAllFromDb,
  trimHistory as trimHistoryFromDb,
  findHistoryByUrl,
  updateVisitedAt,
  type HistoryItem
} from '../historyDb'
import { getCachedIcon, getIconFromDb } from '../../icons/manager'

const VISIT_WINDOW_MS = 5 * 60 * 1000

const historyCache: HistoryItem[] = []

export function syncFromDb(): void {
  historyCache.length = 0
  const records = getAllHistoryFromDb()
  historyCache.push(...records)
}

export function getHistory(): HistoryItem[] {
  if (historyCache.length === 0) {
    syncFromDb()
  }
  return historyCache.map(item => ({
    ...item,
    favicon: resolveFavicon(item.url, item.favicon)
  }))
}

function resolveFavicon(pageUrl: string, originalFavicon?: string): string | undefined {
  const cached = getCachedIcon(pageUrl)
  if (cached) return cached
  const fromDb = getIconFromDb(pageUrl)
  if (fromDb) return fromDb
  return originalFavicon
}

export function recordVisit(title: string, url: string, favicon?: string): void {
  const visitedAt = Date.now()

  // 5 分钟窗口内同一 URL 视为重复访问，更新时间戳而非新建记录
  const existing = findHistoryByUrl(url)
  if (existing && visitedAt - existing.visitedAt < VISIT_WINDOW_MS) {
    updateVisitedAt(existing.id, visitedAt, title, favicon)
    const cacheIdx = historyCache.findIndex(item => item.id === existing.id)
    if (cacheIdx !== -1) {
      historyCache[cacheIdx] = { ...historyCache[cacheIdx], visitedAt, title, favicon }
    }
    return
  }

  // 全新的访问记录
  const id = addHistoryToDb({ title, url, visitedAt, favicon })
  historyCache.unshift({ id, title, url, visitedAt, favicon })
  if (historyCache.length > 100) {
    historyCache.splice(100)
    trimHistoryFromDb(100)
  }
}

export function deleteRecord(id: number): void {
  deleteHistoryIdFromDb(id)
  const index = historyCache.findIndex(item => item.id === id)
  if (index !== -1) {
    historyCache.splice(index, 1)
  }
}

export function clearAllHistory(): void {
  historyCache.length = 0
  clearAllFromDb()
}
