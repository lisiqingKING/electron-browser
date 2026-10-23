import { getDatabase } from '../../shared/database'

getDatabase().exec(`
  CREATE TABLE IF NOT EXISTS shortcuts (
    id        TEXT    PRIMARY KEY,
    name      TEXT    NOT NULL,
    url       TEXT    NOT NULL UNIQUE,
    icon      TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  )
`)

export interface Shortcut {
  id: string
  name: string
  url: string
  icon: string | null
  createdAt: number
  updatedAt: number
}

/** 按创建顺序返回：快捷方式区里"先加的在前"，与用户操作直觉一致 */
export function getAllShortcuts(): Shortcut[] {
  return getDatabase()
    .prepare('SELECT id, name, url, icon, createdAt, updatedAt FROM shortcuts ORDER BY createdAt ASC, id ASC')
    .all() as Shortcut[]
}

export function getShortcutById(id: string): Shortcut | undefined {
  return getDatabase()
    .prepare('SELECT id, name, url, icon, createdAt, updatedAt FROM shortcuts WHERE id = ?')
    .get(id) as Shortcut | undefined
}

export function getShortcutByUrl(url: string): Shortcut | undefined {
  return getDatabase()
    .prepare('SELECT id, name, url, icon, createdAt, updatedAt FROM shortcuts WHERE url = ?')
    .get(url) as Shortcut | undefined
}

export function insertShortcut(shortcut: Shortcut): void {
  getDatabase()
    .prepare(
      `INSERT INTO shortcuts (id, name, url, icon, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(shortcut.id, shortcut.name, shortcut.url, shortcut.icon, shortcut.createdAt, shortcut.updatedAt)
}

export function deleteShortcut(id: string): void {
  getDatabase().prepare('DELETE FROM shortcuts WHERE id = ?').run(id)
}

export function updateShortcutIcon(id: string, icon: string | null, updatedAt: number): void {
  getDatabase().prepare('UPDATE shortcuts SET icon = ?, updatedAt = ? WHERE id = ?').run(icon, updatedAt, id)
}
