import { getDatabase } from './database'

const MAIN_WINDOW_KEY = 'main'

function ensureTextWindowId(): void {
  try {
    const cols = getDatabase().prepare(`PRAGMA table_info(window_config)`).all() as { name: string; type: string }[]
    const windowIdCol = cols.find(c => c.name === 'windowId')
    if (windowIdCol?.type === 'INTEGER') {
      // 老版本 INTEGER windowId，转成 TEXT
      const oldRow = getDatabase().prepare(`SELECT currentTabId FROM window_config`).get() as { currentTabId: string } | undefined
      getDatabase().exec(`DROP TABLE window_config`)
      getDatabase().exec(`CREATE TABLE window_config (windowId TEXT PRIMARY KEY, currentTabId TEXT)`)
      if (oldRow?.currentTabId) {
        getDatabase().prepare(`INSERT INTO window_config (windowId, currentTabId) VALUES (?, ?)`).run(MAIN_WINDOW_KEY, oldRow.currentTabId)
      }
    }
  } catch {
    // 忽略
  }
}

export function getCurrentTabId(_windowId?: number): string | null {
  ensureTextWindowId()
  const row = getDatabase()
    .prepare('SELECT currentTabId FROM window_config WHERE windowId = ?')
    .get(MAIN_WINDOW_KEY) as { currentTabId: string } | undefined
  return row?.currentTabId ?? null
}

export function setCurrentTabId(_windowId: number | null, tabId: string | null): void {
  ensureTextWindowId()

  if (tabId === null) {
    getDatabase()
      .prepare('DELETE FROM window_config WHERE windowId = ?')
      .run(MAIN_WINDOW_KEY)
  } else {
    getDatabase()
      .prepare(
        'INSERT INTO window_config (windowId, currentTabId) VALUES (?, ?)'
          + ' ON CONFLICT(windowId) DO UPDATE SET currentTabId = excluded.currentTabId'
      )
      .run(MAIN_WINDOW_KEY, tabId)
  }
}
