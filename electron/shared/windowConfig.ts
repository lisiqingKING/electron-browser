import { getDatabase } from './database'

const MAIN_WINDOW_KEY = 'main'

export function getCurrentTabId(_windowId?: number): string | null {
  const row = getDatabase()
    .prepare('SELECT currentTabId FROM window_config WHERE windowId = ?')
    .get(MAIN_WINDOW_KEY) as { currentTabId: string } | undefined
  return row?.currentTabId ?? null
}

export function setCurrentTabId(_windowId: number | null, tabId: string | null): void {
  if (tabId === null) {
    getDatabase()
      .prepare('DELETE FROM window_config WHERE windowId = ?')
      .run(MAIN_WINDOW_KEY)
  } else {
    getDatabase()
      .prepare(
        'INSERT OR REPLACE INTO window_config (windowId, currentTabId) VALUES (?, ?)'
      )
      .run(MAIN_WINDOW_KEY, tabId)
  }
}
