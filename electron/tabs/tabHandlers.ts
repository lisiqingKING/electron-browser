import { ipcMain, BrowserWindow } from 'electron'
import { ipcLogger } from '../shared/logger'
import { getWindowById } from '../shared/windowUtils'
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
} from './tabManager'
import { loadTabs, saveTabs, updateTabInfo } from './tabsDb'
import { getWindowByWebContentsId, getTabContext, getTabListData } from './state'
import { showPopup } from '../modules/popup/manager'

export { createTabAndShow } from './tabManager'

function getWindowFromEvent(event: { sender: Electron.WebContents }): BrowserWindow | null {
  const fromWebContents = BrowserWindow.fromWebContents(event.sender)
  if (fromWebContents) return fromWebContents
  return getWindowByWebContentsId(event.sender.id)
}

export function registerTabHandlers() {
  ipcMain.handle('tabs:list', async (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return { tabs: [], currentTabId: null }
    return listTabs(win)
  })

  ipcMain.handle('tabs:create', async (event, tabInfo: { title: string; url: string; isHome?: boolean }, afterTabId?: string, windowId?: number, silent?: boolean) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return null
    const result = createTab(win, tabInfo, afterTabId)
    if (!silent) {
      saveTabs(getTabContext(win).tabs)
    }
    return result
  })

  ipcMain.handle('tabs:createHome', async (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    const result = createHomeTab(win)
    saveTabs(getTabContext(win).tabs)
    return result
  })

  ipcMain.handle('tabs:createDefault', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    const result = createDefaultTab(win, afterTabId)
    saveTabs(getTabContext(win).tabs)
    return result
  })

  ipcMain.handle('tabs:createHistory', async (event, afterTabId?: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return null
    const result = createInternalTab(win, 'history', afterTabId)
    saveTabs(getTabContext(win).tabs)
    return result
  })

  ipcMain.handle('tabs:createDownloads', async (event, afterTabId?: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return null
    const result = createInternalTab(win, 'downloads', afterTabId)
    saveTabs(getTabContext(win).tabs)
    return result
  })

  ipcMain.handle('tabs:createSettings', async (event, afterTabId?: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return null
    const result = createInternalTab(win, 'settings', afterTabId)
    saveTabs(getTabContext(win).tabs)
    return result
  })

  ipcMain.handle('tabs:createLogs', async (event, afterTabId?: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return null
    const result = createInternalTab(win, 'logs', afterTabId)
    saveTabs(getTabContext(win).tabs)
    return result
  })

  ipcMain.handle('tabs:createAI', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    const result = createInternalTab(win, 'ai', afterTabId)
    saveTabs(getTabContext(win).tabs)
    return result
  })

  ipcMain.handle('tabs:createAiSaves', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    const result = createInternalTab(win, 'aiSaves', afterTabId)
    saveTabs(getTabContext(win).tabs)
    return result
  })

  ipcMain.handle('tabs:createFavorites', async (event, afterTabId?: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return null
    const result = createInternalTab(win, 'favorites', afterTabId)
    saveTabs(getTabContext(win).tabs)
    return result
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

  ipcMain.on('tabs:updateInfo', (_event, _tabId: string, _data: { title?: string; url?: string; favicon?: string }) => {
    updateTabInfo()
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

  ipcMain.handle('tabs:close', async (event, tabId: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return null

    const newCurTabId = closeTab(win, tabId)
    saveTabs(getTabContext(win).tabs)
    if (!win.webContents.isDestroyed()) {
      win.webContents.send('tab:list-changed', listTabs(win))
    }
    return newCurTabId
  })

  ipcMain.on('tabs:reload', (event, tabId: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win) {
      win = getWindowFromEvent(event)
    }
    if (!win) return
    reloadTab(win, tabId)
  })

  ipcMain.on('tabs:closeOthers', (event, tabId: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return
    closeOtherTabs(win, tabId)
    saveTabs(getTabContext(win).tabs)
    if (!win.webContents.isDestroyed()) {
      win.webContents.send('tab:list-changed', listTabs(win))
    }
  })

  ipcMain.on('tabs:closeLeft', (event, tabId: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return
    closeTabsToLeft(win, tabId)
    saveTabs(getTabContext(win).tabs)
    if (!win.webContents.isDestroyed()) {
      win.webContents.send('tab:list-changed', listTabs(win))
    }
  })

  ipcMain.on('tabs:closeRight', (event, tabId: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return
    closeTabsToRight(win, tabId)
    saveTabs(getTabContext(win).tabs)
    if (!win.webContents.isDestroyed()) {
      win.webContents.send('tab:list-changed', listTabs(win))
    }
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

  // 暂时禁用
  // ipcMain.on('tabs:openDevTools', (event) => {
  //   const win = getWindowFromEvent(event)
  //   if (!win) return
  //   openDevTools(win)
  // })

  ipcMain.handle('tabs:restore', async (_event, windowId?: number) => {
    const win = getWindowById(windowId)
    if (!win) return

    const savedTabs = loadTabs()
    if (savedTabs.length === 0) return

    for (const savedTab of savedTabs) {
      await createTab(win, { title: savedTab.title, url: savedTab.url }, undefined)
    }

    const ctx = getTabContext(win)
    const firstTab = ctx.tabs.find((t) => !t.isHome)
    if (firstTab?.id) {
      switchToTab(win, firstTab.id)
    }
    saveTabs(ctx.tabs)
    win.webContents.send('tab:list-changed', getTabListData(win))
  })

  // 用 once：只有主窗口会发送此消息，且只需处理一次
  ipcMain.once('tabs:showRestorePrompt', (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    const savedTabs = loadTabs()
    if (savedTabs.length === 0) return
    const contentBounds = win.getContentBounds()
    showPopup({
      x: contentBounds.x + Math.floor(contentBounds.width - 230),
      y: contentBounds.y + 80,
      component: 'RestoreTabsPrompt',
      props: { tabCount: savedTabs.length, windowId: win.id },
    }, win)
  })
}
