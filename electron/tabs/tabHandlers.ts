import { ipcMain, BrowserWindow } from 'electron'
import { ipcLogger } from '../shared/logger'
import { getWindowById } from '../shared/windowUtils'
import { tabChannels } from '../shared/channels'
import { tabsChannels } from './ipcClient'
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
import { loadTabs, saveTabs, clearTabs, updateTabInfo } from './tabsDb'
import { getWindowByWebContentsId, getTabContext, getTabListData } from './state'
import { showPopup } from '../modules/popup/manager'

export { createTabAndShow } from './tabManager'

function getWindowFromEvent(event: { sender: Electron.WebContents }): BrowserWindow | null {
  const fromWebContents = BrowserWindow.fromWebContents(event.sender)
  if (fromWebContents) return fromWebContents
  return getWindowByWebContentsId(event.sender.id)
}

export function registerTabHandlers() {
  ipcMain.handle(tabsChannels.list, async (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return { tabs: [], currentTabId: null }
    return listTabs(win)
  })

  ipcMain.handle(tabsChannels.create, async (event, tabInfo: { title: string; url: string; isHome?: boolean }, afterTabId?: string, windowId?: number, silent?: boolean) => {
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

  ipcMain.handle(tabsChannels.createHome, async (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    const result = createHomeTab(win)
    saveTabs(getTabContext(win).tabs)
    return result
  })

  ipcMain.handle(tabsChannels.createDefault, async (event, afterTabId?: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return null
    const result = createDefaultTab(win, afterTabId)
    saveTabs(getTabContext(win).tabs)
    return result
  })

  ipcMain.handle(tabsChannels.createHistory, async (event, afterTabId?: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return null
    const result = createInternalTab(win, 'history', afterTabId)
    saveTabs(getTabContext(win).tabs)
    return result
  })

  ipcMain.handle(tabsChannels.createDownloads, async (event, afterTabId?: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return null
    const result = createInternalTab(win, 'downloads', afterTabId)
    saveTabs(getTabContext(win).tabs)
    return result
  })

  ipcMain.handle(tabsChannels.createSettings, async (event, afterTabId?: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return null
    const result = createInternalTab(win, 'settings', afterTabId)
    saveTabs(getTabContext(win).tabs)
    return result
  })

  ipcMain.handle(tabsChannels.createLogs, async (event, afterTabId?: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return null
    const result = createInternalTab(win, 'logs', afterTabId)
    saveTabs(getTabContext(win).tabs)
    return result
  })

  ipcMain.handle(tabsChannels.createAI, async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    const result = createInternalTab(win, 'ai', afterTabId)
    saveTabs(getTabContext(win).tabs)
    return result
  })

  ipcMain.handle(tabsChannels.createAiSaves, async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    const result = createInternalTab(win, 'aiSaves', afterTabId)
    saveTabs(getTabContext(win).tabs)
    return result
  })

  ipcMain.handle(tabsChannels.createFavorites, async (event, afterTabId?: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return null
    const result = createInternalTab(win, 'favorites', afterTabId)
    saveTabs(getTabContext(win).tabs)
    return result
  })

  ipcMain.on(tabsChannels.refresh, (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    refreshTab(win)
  })

  ipcMain.on(tabsChannels.updateUrl, (event, url: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    updateUrl(win, url)
  })

  ipcMain.on(tabsChannels.updateInfo, (_event, _tabId: string, _data: { title?: string; url?: string; favicon?: string }) => {
    updateTabInfo()
  })

  ipcMain.handle(tabsChannels.switch, async (event, tabId: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return false

    const result = switchToTab(win, tabId)
    if (!result) {
      ipcLogger.error(`tabs:switch failed - tab not found: ${tabId}`)
      return false
    }

    win.webContents.send(tabChannels.canNavigate, { id: tabId, canGoBack: result.canGoBack, canGoForward: result.canGoForward })
    win.webContents.send(tabChannels.currentChanged, { currentTabId: tabId })
    return true
  })

  ipcMain.handle(tabsChannels.close, async (event, tabId: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return null

    const newCurTabId = closeTab(win, tabId)
    saveTabs(getTabContext(win).tabs)
    if (!win.webContents.isDestroyed()) {
      win.webContents.send(tabChannels.listChanged, listTabs(win))
    }
    return newCurTabId
  })

  ipcMain.on(tabsChannels.reload, (event, tabId: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win) {
      win = getWindowFromEvent(event)
    }
    if (!win) return
    reloadTab(win, tabId)
  })

  ipcMain.on(tabsChannels.closeOthers, (event, tabId: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return
    closeOtherTabs(win, tabId)
    saveTabs(getTabContext(win).tabs)
    if (!win.webContents.isDestroyed()) {
      win.webContents.send(tabChannels.listChanged, listTabs(win))
    }
  })

  ipcMain.on(tabsChannels.closeLeft, (event, tabId: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return
    closeTabsToLeft(win, tabId)
    saveTabs(getTabContext(win).tabs)
    if (!win.webContents.isDestroyed()) {
      win.webContents.send(tabChannels.listChanged, listTabs(win))
    }
  })

  ipcMain.on(tabsChannels.closeRight, (event, tabId: string, windowId?: number) => {
    let win = windowId ? BrowserWindow.fromId(windowId) : null
    if (!win || win.isDestroyed()) {
      win = getWindowFromEvent(event)
    }
    if (!win || win.isDestroyed()) return
    closeTabsToRight(win, tabId)
    saveTabs(getTabContext(win).tabs)
    if (!win.webContents.isDestroyed()) {
      win.webContents.send(tabChannels.listChanged, listTabs(win))
    }
  })

  ipcMain.on(tabsChannels.goBack, (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    goBack(win)
  })

  ipcMain.on(tabsChannels.goForward, (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    goForward(win)
  })

  // 暂时禁用
  // ipcMain.on(tabsChannels.openDevTools, (event) => {
  //   const win = getWindowFromEvent(event)
  //   if (!win) return
  //   openDevTools(win)
  // })

  ipcMain.handle(tabsChannels.restore, async (_event, windowId?: number) => {
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
    win.webContents.send(tabChannels.listChanged, getTabListData(win))
  })

  // 用 on 而不是 once，因为会被触发两次：onMounted 和 main:ready-for-popup
  ipcMain.on(tabsChannels.showRestorePrompt, (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    // 窗口不可见时不处理，等 main:ready-for-popup
    if (!win.isVisible()) return
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

  ipcMain.handle(tabsChannels.clearSaved, () => {
    clearTabs()
  })
}
