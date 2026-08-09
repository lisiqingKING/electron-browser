import { ipcMain, BrowserWindow } from 'electron'
import { getTabContext, getCurTab, updateCurTabBounds, closeTab, openDevToolsForCurTab, getTabListData, switchTab } from '../modules/tabContext'
import { findExistingInternalTab, switchToExistingTab } from '../modules/tabCoreUtils'
import { goBack, goForward, refreshCurTab, updateCurTabUrl, createTabAndShow, resolveAppsUrl } from './tabNavigation'
import { env } from '../shared/env'
import { insertTab, deleteTab, updateTabUrl } from '../features/tabs/tabsDb'
import { registerDownloadHandlers } from '../features/downloads/downloadHandlers'

export { createTabAndShow }

function getWindowFromEvent(event: { sender: Electron.WebContents }): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

async function createOrSwitchInternalTab(
  url: string,
  title: string,
  win: BrowserWindow,
  afterTabId?: string
): Promise<string | null> {
  console.log(`[create${title}] 加载 URL:`, url)
  const existing = findExistingInternalTab(win, url)
  if (existing) {
    console.log(`[create${title}] 已存在，切换到:`, existing.info.id)
    return switchToExistingTab(win, existing)
  }
  const time = Date.now()
  const id: string = insertTab({ title, url, time })
  return createTabAndShow({ title, url }, win, afterTabId, id)
}

export function registerTabHandlers() {
  ipcMain.handle('tabs:list', async (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return { tabs: [], currentTabId: null }
    return getTabListData(win)
  })

  ipcMain.handle('tabs:create', async (event, tabInfo: { title: string; url: string; isHome?: boolean }, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    if (tabInfo.isHome) {
      return createTabAndShow(tabInfo, win, afterTabId)
    }
    const time = Date.now()
    const id: string = insertTab({ title: tabInfo.title, url: tabInfo.url, time })
    return createTabAndShow({ title: tabInfo.title, url: tabInfo.url }, win, afterTabId, id)
  })

  ipcMain.handle('tabs:createHome', async (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    const ctx = getTabContext(win)
    const existing = [...ctx.webContentViewMap.values()].find(t => t.info.isHome)
    if (existing) return existing.info.id

    const url = env.getAppUrl()
    console.log('[createHome] 加载 URL:', url)
    return createTabAndShow({ title: '首页', url, isHome: true }, win)
  })

  ipcMain.handle('tabs:createDefault', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    const url = env.getNewTabUrl()
    console.log('[createDefault] 加载 URL:', url)
    const time = Date.now()
    const id: string = insertTab({ title: '新标签页', url, time })
    return createTabAndShow({ title: '新标签页', url }, win, afterTabId, id)
  })

  ipcMain.handle('tabs:createHistory', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    return createOrSwitchInternalTab(env.getHistoryUrl(), '历史记录', win, afterTabId)
  })

  ipcMain.handle('tabs:createDownloads', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    return createOrSwitchInternalTab(env.getDownloadsUrl(), '下载管理', win, afterTabId)
  })

  ipcMain.handle('tabs:createSettings', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    return createOrSwitchInternalTab(env.getSettingsUrl(), '设置', win, afterTabId)
  })

  ipcMain.handle('tabs:createLogs', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    return createOrSwitchInternalTab(env.getLogsUrl(), '日志管理', win, afterTabId)
  })

  ipcMain.handle('tabs:createAI', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    return createOrSwitchInternalTab(env.getAIUrl(), 'AI 助手', win, afterTabId)
  })

  ipcMain.handle('tabs:createAiSaves', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    return createOrSwitchInternalTab(env.getAiSavesUrl(), 'AI 保存记录', win, afterTabId)
  })

  ipcMain.handle('tabs:createFavorites', async (event, afterTabId?: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    return createOrSwitchInternalTab(env.getFavoritesUrl(), '收藏夹', win, afterTabId)
  })

  ipcMain.on('tabs:refresh', (event) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    refreshCurTab(win)
  })

  ipcMain.on('tabs:updateUrl', (event, url: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    const resolvedUrl = resolveAppsUrl(url) || url
    updateCurTabUrl(resolvedUrl, win)
    const ctx = getTabContext(win)
    const curTab = getCurTab(win)
    if (curTab) updateCurTabBounds(ctx.webContentViewMap.get(curTab.info.id!)!, win)
    if (curTab) updateTabUrl(curTab.info.id!, resolvedUrl)
  })

  ipcMain.handle('tabs:switch', async (event, tabId: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return false
    switchTab(tabId, win)
    const ctx = getTabContext(win)
    const targetTab = ctx.webContentViewMap.get(tabId)
    if (targetTab?.view) {
      const canGoBack = targetTab.view.webContents.canGoBack()
      const canGoForward = targetTab.view.webContents.canGoForward()
      targetTab.info.canGoBack = canGoBack
      targetTab.info.canGoForward = canGoForward
      win.webContents.send('tab:can-navigate', { id: tabId, canGoBack, canGoForward })
    }
    win.webContents.send('tab:current-changed', { currentTabId: tabId })
    return true
  })

  ipcMain.handle('tabs:close', async (event, tabId: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return null
    const newCurTabId = closeTab(tabId, win)
    deleteTab(tabId)
    win.webContents.send('tab:list-changed', getTabListData(win))
    return newCurTabId
  })

  ipcMain.on('tabs:reload', (event, tabId: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    const ctx = getTabContext(win)
    const tab = ctx.webContentViewMap.get(tabId)
    if (tab) {
      tab.view.webContents.reload()
    }
  })

  ipcMain.on('tabs:closeOthers', (event, tabId: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    const ctx = getTabContext(win)
    const closedIds = ctx.tabs.filter((t) => t.id !== tabId && !t.isHome).map((t) => t.id!)
    closedIds.forEach((id) => closeTab(id, win))
    closedIds.forEach(deleteTab)
    win.webContents.send('tab:list-changed', getTabListData(win))
  })

  ipcMain.on('tabs:closeLeft', (event, tabId: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    const ctx = getTabContext(win)
    const targetIndex = ctx.tabs.findIndex((t) => t.id === tabId)
    if (targetIndex === -1) return

    const closedIds = ctx.tabs.slice(0, targetIndex).filter((t) => !t.isHome).map((t) => t.id!)
    closedIds.forEach((id) => closeTab(id, win))
    closedIds.forEach(deleteTab)
    win.webContents.send('tab:list-changed', getTabListData(win))
  })

  ipcMain.on('tabs:closeRight', (event, tabId: string) => {
    const win = getWindowFromEvent(event)
    if (!win) return
    const ctx = getTabContext(win)
    const targetIndex = ctx.tabs.findIndex((t) => t.id === tabId)
    if (targetIndex === -1) return

    const closedIds = ctx.tabs.slice(targetIndex + 1).filter((t) => !t.isHome).map((t) => t.id!)
    closedIds.forEach((id) => closeTab(id, win))
    closedIds.forEach(deleteTab)
    win.webContents.send('tab:list-changed', getTabListData(win))
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
    openDevToolsForCurTab(win)
  })

  registerDownloadHandlers()
}
