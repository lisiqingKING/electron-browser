import { BrowserWindow } from 'electron'
import type { TabContext } from './types'
import { getCachedIcon, getIconFromDb } from '../../features/icons/iconsManager'

export const windowTabContexts = new Map<number, TabContext>()

export function getTabContext(win: BrowserWindow): TabContext {
  const existing = windowTabContexts.get(win.id)
  if (existing) return existing

  const ctx: TabContext = {
    tabs: [],
    curTabId: null,
    webContentViewMap: new Map()
  }
  windowTabContexts.set(win.id, ctx)
  return ctx
}

export function getCurTab(win: BrowserWindow) {
  const ctx = getTabContext(win)
  return ctx.curTabId ? ctx.webContentViewMap.get(ctx.curTabId) : null
}

export function setCurTabId(id: string, win: BrowserWindow) {
  getTabContext(win).curTabId = id
}

export function getTabListData(win: BrowserWindow) {
  const ctx = getTabContext(win)
  const tabs = ctx.tabs.map(t => {
    const entry = ctx.webContentViewMap.get(t.id!)
    if (!entry) return null
    const info = entry.info
    // 补充缓存的 favicon
    if (!info.favicon) {
      const cached = getCachedIcon(info.url) || getIconFromDb(info.url)
      if (cached) {
        info.favicon = cached
      }
    }
    return info
  }).filter(Boolean)

  return {
    tabs,
    currentTabId: ctx.curTabId
  }
}

export function cleanupWindowContext(win: BrowserWindow): void {
  windowTabContexts.delete(win.id)
}
