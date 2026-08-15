import { ipcMain, BrowserWindow } from 'electron'
import { ipcLogger } from '../shared/logger'
import {
  listTabs,
  createTab,
  createHomeTab,
  createDefaultTab,
  createInternalTab,
  switchToTab,
  refreshTab,
  goBack,
  goForward,
  updateUrl,
  closeTab,
  reloadTab,
  closeOtherTabs,
  closeTabsToLeft,
  closeTabsToRight,
  openDevTools,
} from './tabManager'

export { createTabAndShow } from './tabManager'

function getWindowFromEvent(event: { sender: Electron.WebContents }): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

export function registerTabHandlers() {
  ipcMain.handle('tabs:list', async (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return { tabs: [], currentTabId: null }
    return listTabs(win)
  })

  ipcMain.handle('tabs:create', async (event, tabInfo: { title: string; url: string; isHome?: boolean }, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    return createTab(win, tabInfo, afterTabId)
  })

  ipcMain.handle('tabs:createHome', async (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    return createHomeTab(win)
  })

  ipcMain.handle('tabs:createDefault', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    return createDefaultTab(win, afterTabId)
  })

  ipcMain.handle('tabs:createHistory', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    return createInternalTab(win, 'history', afterTabId)
  })

  ipcMain.handle('tabs:createDownloads', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    return createInternalTab(win, 'downloads', afterTabId)
  })

  ipcMain.handle('tabs:createSettings', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    return createInternalTab(win, 'settings', afterTabId)
  })

  ipcMain.handle('tabs:createLogs', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    return createInternalTab(win, 'logs', afterTabId)
  })

  ipcMain.handle('tabs:createAI', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    return createInternalTab(win, 'ai', afterTabId)
  })

  ipcMain.handle('tabs:createAiSaves', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    return createInternalTab(win, 'aiSaves', afterTabId)
  })

  ipcMain.handle('tabs:createFavorites', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    return createInternalTab(win, 'favorites', afterTabId)
  })

  ipcMain.on('tabs:refresh', (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    refreshTab(win)
  })

  ipcMain.on('tabs:updateUrl', (event, url: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    updateUrl(win, url)
  })

  ipcMain.handle('tabs:switch', async (event, tabId: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return false

    const result = switchToTab(win, tabId)
    if (!result) {
      ipcLogger.error(`tabs:switch failed - tab not found: ${tabId}`)
      return false
    }

    win.webContents.send('tab:can-navigate', { id: tabId, canGoBack: result.canGoBack, canGoForward: result.canGoForward })
    win.webContents.send('tab:current-changed', { currentTabId: tabId })
    return true
  })

  ipcMain.handle('tabs:close', async (event, tabId: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null

    const newCurTabId = closeTab(win, tabId)
    win.webContents.send('tab:list-changed', listTabs(win))
    return newCurTabId
  })

  ipcMain.on('tabs:reload', (event, tabId: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    reloadTab(win, tabId)
  })

  ipcMain.on('tabs:closeOthers', (event, tabId: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    closeOtherTabs(win, tabId)
    win.webContents.send('tab:list-changed', listTabs(win))
  })

  ipcMain.on('tabs:closeLeft', (event, tabId: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    closeTabsToLeft(win, tabId)
    win.webContents.send('tab:list-changed', listTabs(win))
  })

  ipcMain.on('tabs:closeRight', (event, tabId: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    closeTabsToRight(win, tabId)
    win.webContents.send('tab:list-changed', listTabs(win))
  })

  ipcMain.on('tabs:goBack', (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    goBack(win)
  })

  ipcMain.on('tabs:goForward', (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    goForward(win)
  })

  ipcMain.on('tabs:openDevTools', (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    openDevTools(win)
  })
}
