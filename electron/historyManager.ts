import { addHistory, getAllHistory, clearAllHistory, HistoryRecord } from './historyDb'

// 内存缓存
const historyList: HistoryRecord[] = []

// 同步数据库到内存
export function syncHistoryFromDb(): void {
  const records = getAllHistory()
  historyList.length = 0
  historyList.push(...records)
}

// 添加历史记录
export function recordVisit(tabId: string, title: string, url: string): void {
  // 写入数据库
  addHistory(tabId, title, url)

  // 同步到内存
  const record: HistoryRecord = {
    id: Date.now(),
    tabId,
    title,
    url,
    visitedAt: Date.now()
  }

  historyList.unshift(record)
}

// 获取所有历史记录
export function getHistory(): HistoryRecord[] {
  if (historyList.length === 0) {
    syncHistoryFromDb()
  }
  return [...historyList]
}

// 清除所有历史记录
export function clearHistory(): void {
  clearAllHistory()
  historyList.length = 0
}
