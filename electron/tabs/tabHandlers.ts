import { ipcMain, BrowserWindow } from 'electron'
import { getCurTab, webContentViewMap, updateCurTabBounds, closeTab, setCurTabId, openDevToolsForCurTab, tabs, getTabListData, findExistingInternalTab, switchToExistingTab } from './tabCore'
import { goBack, goForward, refreshCurTab, updateCurTabUrl, createTabAndShow, resolveAppsUrl } from './tabNavigation'
import { env } from '../shared/env'
import { insertTab, deleteTab, updateTabUrl, setActiveTab } from '../shared/database'
import { registerDownloadHandlers } from '../features/downloads/downloadHandlers'

export { webContentViewMap, updateCurTabBounds, getCurTab, openDevToolsForCurTab } from './tabCore'
export { createTabAndShow }

// ============== 辅助函数 ==============

/**
 * 创建或切换到已存在的内部标签页
 */
async function createOrSwitchInternalTab(
  url: string,
  title: string,
  win: BrowserWindow,
  afterTabId?: string
): Promise<string | null> {
  console.log(`[create${title}] 加载 URL:`, url)
  const existing = findExistingInternalTab(url)
  if (existing) {
    console.log(`[create${title}] 已存在，切换到:`, existing.info.id)
    return switchToExistingTab(win, existing)
  }
  const time = Date.now()
  const id = insertTab({ title, url, time })
  return createTabAndShow({ title, url }, win, afterTabId, id)
}

// ============== IPC Handlers ==============

export function registerTabHandlers(win: BrowserWindow) {
  // 列表 - 返回完整数据
  ipcMain.handle('tabs:list', async () => {
    return getTabListData()
  })

  // 创建普通标签页
  ipcMain.handle('tabs:create', async (_event, tabInfo: { title: string; url: string; isHome?: boolean }, afterTabId?: string) => {
    if (tabInfo.isHome) {
      return createTabAndShow(tabInfo, win, afterTabId)
    }
    const time = Date.now()
    const id = insertTab({ title: tabInfo.title, url: tabInfo.url, time })
    return createTabAndShow({ ...tabInfo, time }, win, afterTabId, id)
  })

  // 创建首页（常驻不可关闭）
  ipcMain.handle('tabs:createHome', async () => {
    // 已有首页则不重复创建
    const existing = [...webContentViewMap.values()].find(t => t.info.isHome)
    if (existing) return existing.info.id

    const url = env.getAppUrl()
    console.log('[createHome] 加载 URL:', url)
    // 首页不插入数据库，只创建内存对象
    return createTabAndShow({ title: '首页', url, isHome: true }, win)
  })

  // 创建新标签页（搜索页）
  ipcMain.handle('tabs:createDefault', async (_event, afterTabId?: string) => {
    const url = env.getNewTabUrl()
    console.log('[createDefault] 加载 URL:', url)
    const time = Date.now()
    const id = insertTab({ title: '新标签页', url, time })
    return createTabAndShow({ title: '新标签页', url, time }, win, afterTabId, id)
  })

  // 创建历史页（已存在则切换）
  ipcMain.handle('tabs:createHistory', async (_event, afterTabId?: string) => {
    return createOrSwitchInternalTab(env.getHistoryUrl(), '历史记录', win, afterTabId)
  })

  // 创建下载管理页（已存在则切换）
  ipcMain.handle('tabs:createDownloads', async (_event, afterTabId?: string) => {
    return createOrSwitchInternalTab(env.getDownloadsUrl(), '下载管理', win, afterTabId)
  })

  // 创建设置页（已存在则切换）
  ipcMain.handle('tabs:createSettings', async (_event, afterTabId?: string) => {
    return createOrSwitchInternalTab(env.getSettingsUrl(), '设置', win, afterTabId)
  })

  // 创建日志页（已存在则切换）
  ipcMain.handle('tabs:createLogs', async (_event, afterTabId?: string) => {
    return createOrSwitchInternalTab(env.getLogsUrl(), '日志管理', win, afterTabId)
  })

  // 创建 AI 助手页（已存在则切换）
  ipcMain.handle('tabs:createAI', async (_event, afterTabId?: string) => {
    return createOrSwitchInternalTab(env.getAIUrl(), 'AI 助手', win, afterTabId)
  })

  // 创建 AI 保存记录页（已存在则切换）
  ipcMain.handle('tabs:createAiSaves', async (_event, afterTabId?: string) => {
    return createOrSwitchInternalTab(env.getAiSavesUrl(), 'AI 保存记录', win, afterTabId)
  })

  // 创建收藏页（已存在则切换）
  ipcMain.handle('tabs:createFavorites', async (_event, afterTabId?: string) => {
    return createOrSwitchInternalTab(env.getFavoritesUrl(), '收藏夹', win, afterTabId)
  })

  // 刷新
  ipcMain.on('tabs:refresh', () => {
    refreshCurTab(win)
  })

  // 更新URL
  ipcMain.on('tabs:updateUrl', (_event, url: string) => {
    // 解析 ligbox:// 协议
    const resolvedUrl = resolveAppsUrl(url) || url
    updateCurTabUrl(resolvedUrl, win)
    updateCurTabBounds(webContentViewMap.get(getCurTab()?.info.id!)!, win)
    const curTab = getCurTab()
    if (curTab) updateTabUrl(curTab.info.id!, resolvedUrl)
  })

  // 切换标签
  ipcMain.handle('tabs:switch', async (_event, tabId: string) => {
    const curTab = getCurTab()
    if (curTab?.view) {
      win.contentView.removeChildView(curTab.view)
    }

    const targetTab = webContentViewMap.get(tabId)
    if (targetTab) {
      win.contentView.addChildView(targetTab.view)
      updateCurTabBounds(targetTab, win)
      setCurTabId(tabId)
      // 直接在 targetTab 上更新状态并发送
      const canGoBack = targetTab.view.webContents.canGoBack()
      const canGoForward = targetTab.view.webContents.canGoForward()
      targetTab.info.canGoBack = canGoBack
      targetTab.info.canGoForward = canGoForward
      console.log('[tabs:switch] tabId:', tabId, 'canGoBack:', canGoBack, 'canGoForward:', canGoForward)
      win.webContents.send('tab:can-navigate', { id: tabId, canGoBack, canGoForward })
      win.webContents.send('tab:current-changed', { currentTabId: tabId })
      setActiveTab(tabId)
    }
    return true
  })

  // 关闭标签
  ipcMain.handle('tabs:close', async (_event, tabId: string) => {
    const newCurTabId = closeTab(tabId, win)
    deleteTab(tabId)
    win.webContents.send('tab:list-changed', getTabListData())
    return newCurTabId
  })

  // 刷新指定标签
  ipcMain.on('tabs:reload', (_event, tabId: string) => {
    const tab = webContentViewMap.get(tabId)
    if (tab) {
      tab.view.webContents.reload()
    }
  })

  // 关闭其他标签
  ipcMain.on('tabs:closeOthers', (_event, tabId: string) => {
    const closedIds = tabs.filter((t) => t.id !== tabId && !t.isHome).map((t) => t.id!)
    closedIds.forEach((id) => closeTab(id, win))
    closedIds.forEach(deleteTab)
    win.webContents.send('tab:list-changed', getTabListData())
  })

  // 关闭左侧标签
  ipcMain.on('tabs:closeLeft', (_event, tabId: string) => {
    const targetIndex = tabs.findIndex((t) => t.id === tabId)
    if (targetIndex === -1) return

    const closedIds = tabs.slice(0, targetIndex).filter((t) => !t.isHome).map((t) => t.id!)
    closedIds.forEach((id) => closeTab(id, win))
    closedIds.forEach(deleteTab)
    win.webContents.send('tab:list-changed', getTabListData())
  })

  // 关闭右侧标签
  ipcMain.on('tabs:closeRight', (_event, tabId: string) => {
    const targetIndex = tabs.findIndex((t) => t.id === tabId)
    if (targetIndex === -1) return

    const closedIds = tabs.slice(targetIndex + 1).filter((t) => !t.isHome).map((t) => t.id!)
    closedIds.forEach((id) => closeTab(id, win))
    closedIds.forEach(deleteTab)
    win.webContents.send('tab:list-changed', getTabListData())
  })

  // 后退
  ipcMain.on('tabs:goBack', () => {
    goBack(win)
  })

  // 前进
  ipcMain.on('tabs:goForward', () => {
    goForward(win)
  })

  // 打开当前 Tab 的开发者工具
  ipcMain.on('tabs:openDevTools', () => {
    openDevToolsForCurTab()
  })

  // 下载管理器 IPC handlers
  registerDownloadHandlers()
}
