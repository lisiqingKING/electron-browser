import { getCache, setCache } from '../shared/cache'

export interface TabRow {
  id: string
  title: string
  url: string
  createdAt: number
  updatedAt: number
  favicon?: string
}

const CACHE_KEY_TABS = 'opened_tabs'

export function saveTabs(
  tabList: { id?: string; title: string; url: string; time?: number; isHome?: boolean }[]
): void {
  const nonHomeTabs = tabList
    .filter(t => !t.isHome && t.id)
    .map(t => ({
      id: t.id as string,
      title: t.title,
      url: t.url,
      createdAt: t.time || Date.now(),
      updatedAt: Date.now(),
    }))

  if (nonHomeTabs.length === 0) return

  // 合并已有 tabs，避免被覆盖
  const existing = loadTabs()
  const merged = [...existing]
  for (const tab of nonHomeTabs) {
    if (!merged.find(t => t.url === tab.url)) {
      merged.push(tab)
    }
  }

  setCache(CACHE_KEY_TABS, JSON.stringify(merged))
}

export function loadTabs(): TabRow[] {
  const json = getCache(CACHE_KEY_TABS)
  if (!json) return []
  try {
    const tabs = JSON.parse(json) as TabRow[]
    return tabs
  } catch {
    return []
  }
}

// 以下函数已废弃，不再使用（增量写入已移除）
export function insertTab(): string {
  return ''
}

export function deleteTab(): void {
  // no-op
}

export function updateTabInfo(): void {
  // no-op
}

export function updateTabUrl(): void {
  // no-op
}
