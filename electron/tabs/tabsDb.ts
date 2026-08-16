import { getDatabase } from '../shared/database'
import { randomUUID } from 'node:crypto'

export interface TabRow {
  id: string
  title: string
  url: string
  createdAt: number
  updatedAt: number
  favicon?: string
}

export function saveTabs(
  tabList: { id?: string; title: string; url: string; time?: number; isHome?: boolean }[]
): void {
  const database = getDatabase()
  const now = Date.now()

  database.exec('DELETE FROM tabs')

  const insert = database.prepare(
    'INSERT INTO tabs (id, title, url, createdAt, updatedAt, isHome) VALUES (?, ?, ?, ?, ?, ?)'
  )

  const insertMany = database.transaction(() => {
    for (const tab of tabList) {
      if (!tab.id || tab.isHome) continue
      insert.run(tab.id, tab.title, tab.url, tab.time || now, now, 0)
    }
  })

  insertMany()
  console.log('[Database] Saved', tabList.length, 'tabs')
}

export function loadTabs(): TabRow[] {
  const database = getDatabase()

  const tabs = database
    .prepare('SELECT * FROM tabs WHERE isHome = 0 ORDER BY createdAt ASC')
    .all() as TabRow[]

  console.log('[Database] Loaded', tabs.length, 'tabs')
  return tabs
}

export function insertTab(tab: { title: string; url: string; time: number; isHome?: boolean }): string {
  const id = `tab-${randomUUID()}`
  const database = getDatabase()
  database
    .prepare(
      'INSERT INTO tabs (id, title, url, createdAt, updatedAt, isHome) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(id, tab.title, tab.url, tab.time, tab.time, tab.isHome ? 1 : 0)
  return id
}

export function deleteTab(id: string): void {
  const database = getDatabase()
  database.prepare('DELETE FROM tabs WHERE id = ?').run(id)
}

export function updateTabInfo(id: string, data: { title?: string; url?: string; favicon?: string }): void {
  const database = getDatabase()
  const sets: string[] = []
  const values: (string | number)[] = []

  if (data.title !== undefined) {
    sets.push('title = ?')
    values.push(data.title)
  }
  if (data.url !== undefined) {
    sets.push('url = ?')
    values.push(data.url)
  }
  if (data.favicon !== undefined) {
    sets.push('favicon = ?')
    values.push(data.favicon)
  }

  if (sets.length === 0) return

  sets.push('updatedAt = ?')
  values.push(Date.now())
  values.push(id)

  database
    .prepare(`UPDATE tabs SET ${sets.join(', ')} WHERE id = ?`)
    .run(...values)
}

export function updateTabUrl(id: string, url: string): void {
  updateTabInfo(id, { url })
}
