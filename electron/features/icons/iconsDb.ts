import { getDatabase } from '../../shared/database'

export interface PageIcon {
  url: string
  icon: string
  iconUrl: string | null
  updatedAt: number
}

export function getIconByUrl(url: string): PageIcon | undefined {
  return getDatabase()
    .prepare('SELECT * FROM page_icons WHERE url = ?')
    .get(url) as PageIcon | undefined
}

export function saveIcon(url: string, icon: string, iconUrl: string | null): void {
  const updatedAt = Date.now()
  getDatabase()
    .prepare(`
      INSERT INTO page_icons (url, icon, iconUrl, updatedAt)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET icon = excluded.icon, iconUrl = excluded.iconUrl, updatedAt = excluded.updatedAt
    `)
    .run(url, icon, iconUrl, updatedAt)
}

export function deleteIcon(url: string): void {
  getDatabase().prepare('DELETE FROM page_icons WHERE url = ?').run(url)
}
