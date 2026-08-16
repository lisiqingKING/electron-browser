import { BrowserWindow, WebContentsView } from 'electron'
import type { TabInfo } from './types'
import { getTabContext, windowTabContexts } from './context'
import type { TabContext } from './types'

export interface TabEntry {
  tabInfo: TabInfo
  view: WebContentsView
}

function findWindowByTab(tabId: string): { win: BrowserWindow; ctx: TabContext } | null {
  for (const [winId, ctx] of windowTabContexts) {
    if (ctx.webContentViewMap.has(tabId)) {
      const win = BrowserWindow.fromId(winId)
      if (win) return { win, ctx }
    }
  }
  return null
}

export function getTabBrowserWindow(tabId: string): BrowserWindow | null {
  const result = findWindowByTab(tabId)
  return result?.win ?? null
}

export function getTabEntry(tabId: string): TabEntry | null {
  const result = findWindowByTab(tabId)
  if (!result) return null
  const entry = result.ctx.webContentViewMap.get(tabId)!
  return { tabInfo: entry.info, view: entry.view }
}

export function moveTabToWindow(tabId: string, targetWin: BrowserWindow): void {
  const result = findWindowByTab(tabId)
  if (!result) return
  const { ctx: sourceCtx } = result

  const entry = sourceCtx.webContentViewMap.get(tabId)
  if (!entry) return

  const idx = sourceCtx.tabs.findIndex(t => t.id === tabId)
  if (idx !== -1) sourceCtx.tabs.splice(idx, 1)
  sourceCtx.webContentViewMap.delete(tabId)

  const targetCtx = getTabContext(targetWin)
  targetCtx.tabs.push(entry.info)
  targetCtx.webContentViewMap.set(tabId, entry)
}

export function cleanupWindowTabs(winId: number): void {
  windowTabContexts.delete(winId)
}

export function getWindowByWebContentsId(wcId: number): BrowserWindow | null {
  for (const [winId, ctx] of windowTabContexts) {
    for (const entry of ctx.webContentViewMap.values()) {
      if (entry.view && entry.view.webContents.id === wcId) {
        return BrowserWindow.fromId(winId)
      }
    }
  }
  return null
}
