import { BrowserWindow } from 'electron'
import { getTabContext } from './context'

export function openDevToolsForTab(tabId: string, win: BrowserWindow) {
  const ctx = getTabContext(win)
  const tab = ctx.webContentViewMap.get(tabId)
  if (tab?.view) {
    tab.view.webContents.openDevTools()
  }
}

export function openDevToolsForCurTab(win: BrowserWindow) {
  const ctx = getTabContext(win)
  const curTabId = ctx.curTabId
  if (!curTabId) return
  const tab = ctx.webContentViewMap.get(curTabId)
  if (tab?.view) {
    tab.view.webContents.openDevTools()
  }
}
