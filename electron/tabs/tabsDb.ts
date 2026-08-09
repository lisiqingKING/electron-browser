import { getDatabase } from '../shared/database'
import { randomUUID } from 'node:crypto'

export interface TabRow {
  id: string
  title: string
  url: string
  createdAt: number
  updatedAt: number
  isActive: number
}

export function saveTabs(
  tabList: { id?: string; title: string; url: string; time?: number; isHome?: boolean }[],
  currentTabId: string | null
): void {
  const database = getDatabase()
  const now = Date.now()

  database.exec('DELETE FROM tabs')

  const insert = database.prepare(
    'INSERT INTO tabs (id, title, url, createdAt, updatedAt, isActive, isHome) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )

  const insertMany = database.transaction(() => {
    for (const tab of tabList) {
      if (!tab.id || tab.isHome) continue
      const isActive = tab.id === currentTabId ? 1 : 0
      insert.run(tab.id, tab.title, tab.url, tab.time || now, now, isActive, 0)
    }
  })

  insertMany()
  console.log('[Database] Saved', tabList.length, 'tabs')
}

export function loadTabs(): { tabs: TabRow[]; currentTabId: string | null } {
  const database = getDatabase()

  const tabs = database
    .prepare('SELECT * FROM tabs WHERE isHome = 0 ORDER BY createdAt ASC')
    .all() as TabRow[]

  const activeTab = tabs.find((t) => t.isActive === 1)
  const currentTabId = activeTab?.id || tabs[0]?.id || null

  console.log('[Database] Loaded', tabs.length, 'tabs')
  return { tabs, currentTabId }
}

export function insertTab(tab: { title: string; url: string; time: number; isHome?: boolean }): string {
  const id = `tab-${randomUUID()}`
  const database = getDatabase()
  database
    .prepare(
      'INSERT INTO tabs (id, title, url, createdAt, updatedAt, isActive, isHome) VALUES (?, ?, ?, ?, ?, 0, ?)'
    )
    .run(id, tab.title, tab.url, tab.time, tab.time, tab.isHome ? 1 : 0)
  return id
}

export function deleteTab(id: string): void {
  const database = getDatabase()
  database.prepare('DELETE FROM tabs WHERE id = ?').run(id)
}

export function updateTabUrl(id: string, url: string): void {
  const database = getDatabase()
  database
    .prepare('UPDATE tabs SET url = ?, updatedAt = ? WHERE id = ?')
    .run(url, Date.now(), id)
}

export function setActiveTab(id: string): void {
  const database = getDatabase()
  database.exec('UPDATE tabs SET isActive = 0')
  database.prepare('UPDATE tabs SET isActive = 1 WHERE id = ?').run(id)
}
