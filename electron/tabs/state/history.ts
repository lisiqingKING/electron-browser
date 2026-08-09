export interface TabHistoryEntry {
  url: string
  actualUrl: string
}

export interface TabHistory {
  entries: TabHistoryEntry[]
  currentIndex: number
}

export const tabNavHistoryMap = new Map<string, TabHistory>()

export function pushHistory(tabId: string, url: string, actualUrl: string) {
  let history = tabNavHistoryMap.get(tabId)
  if (!history) {
    history = { entries: [], currentIndex: -1 }
    tabNavHistoryMap.set(tabId, history)
  }
  history.entries = history.entries.slice(0, history.currentIndex + 1)
  history.entries.push({ url, actualUrl })
  history.currentIndex = history.entries.length - 1
}

export function goBackInHistory(tabId: string): TabHistoryEntry | null {
  const history = tabNavHistoryMap.get(tabId)
  if (!history || history.currentIndex <= 0) return null
  history.currentIndex--
  return history.entries[history.currentIndex]
}

export function goForwardInHistory(tabId: string): TabHistoryEntry | null {
  const history = tabNavHistoryMap.get(tabId)
  if (!history || history.currentIndex >= history.entries.length - 1) return null
  history.currentIndex++
  return history.entries[history.currentIndex]
}

export function canGoBackInHistory(tabId: string): boolean {
  const history = tabNavHistoryMap.get(tabId)
  return !!history && history.currentIndex > 0
}

export function canGoForwardInHistory(tabId: string): boolean {
  const history = tabNavHistoryMap.get(tabId)
  return !!history && history.currentIndex < history.entries.length - 1
}

export function removeNavHistory(tabId: string) {
  tabNavHistoryMap.delete(tabId)
}
