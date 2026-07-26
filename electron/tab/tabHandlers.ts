import { ipcMain, BrowserWindow, app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { getCurTab, webContentViewMap, updateCurTabBounds, closeTab, setCurTabId, openDevToolsForCurTab, isInternalTab, tabs, getTabListData } from './tabCore'
import { goBack, goForward, refreshCurTab, updateCurTabUrl, createTabAndShow, resolveAppsUrl } from './tabNavigation'
import { getHistory, clearAllHistory, deleteRecord } from '../history/historyManager'
import { getSetting, setSetting, getAllSettings } from '../settings/settingsManager'
import {
  getAllChatSessions,
  getChatSessionsPage,
  createChatSession,
  updateTitle,
  updateMessages,
  deleteChatSession,
  updatePinned,
} from '../ai/aiConversationManager'
import { env } from '../env'
import { registerDownloadHandlers } from '../downloads/downloadHandlers'
import { insertTab, deleteTab, updateTabUrl, setActiveTab } from '../database/index'

export { webContentViewMap, updateCurTabBounds, getCurTab, openDevToolsForCurTab } from './tabCore'
export { createTabAndShow }

export function registerTabHandlers(win: BrowserWindow) {
  // 列表 - 返回完整数据
  ipcMain.handle('tabs:list', async () => {
    return getTabListData()
  })

  // 创建普通标签页
  ipcMain.handle('tabs:create', async (_event, tabInfo: { title: string; url: string; isHome?: boolean }, afterTabId?: string) => {
    const id = createTabAndShow(tabInfo, win, afterTabId)
    if (id && !tabInfo.isHome) {
      const tab = tabs.find((t) => t.id === id)
      if (tab) insertTab({ id, title: tab.title, url: tab.url, time: tab.time! })
    }
    return id
  })

  // 创建首页（常驻不可关闭）
  ipcMain.handle('tabs:createHome', async () => {
    // 已有首页则不重复创建
    const existing = [...webContentViewMap.values()].find(t => t.info.isHome)
    if (existing) return existing.info.id

    const url = env.getAppUrl()
    console.log('[createHome] 加载 URL:', url)
    const id = createTabAndShow({ title: '首页', url, isHome: true }, win)
    // 首页标记为 isHome，loadTabs 会自动过滤
    if (id) {
      const tab = tabs.find((t) => t.id === id)
      if (tab) insertTab({ id, title: tab.title, url: tab.url, time: tab.time!, isHome: true })
    }
    return id
  })

  // 创建新标签页（搜索页）
  ipcMain.handle('tabs:createDefault', async (_event, afterTabId?: string) => {
    const url = env.getNewTabUrl()
    console.log('[createDefault] 加载 URL:', url)
    const id = createTabAndShow({ title: '新标签页', url }, win, afterTabId)
    if (id) {
      const tab = tabs.find((t) => t.id === id)
      if (tab) insertTab({ id, title: tab.title, url: tab.url, time: tab.time! })
    }
    return id
  })

  // 创建历史页
  ipcMain.handle('tabs:createHistory', async (_event, afterTabId?: string) => {
    const url = env.getHistoryUrl()
    console.log('[createHistory] 加载 URL:', url)
    const id = createTabAndShow({ title: '历史记录', url }, win, afterTabId)
    if (id) {
      const tab = tabs.find((t) => t.id === id)
      if (tab) insertTab({ id, title: tab.title, url: tab.url, time: tab.time! })
    }
    return id
  })

  // 创建下载管理页 (dev 走 Vite, packaged 走 lsqapp:// 协议)
  ipcMain.handle('tabs:createDownloads', async (_event, afterTabId?: string) => {
    const url = env.getDownloadsUrl()
    console.log('[createDownloads] 加载 URL:', url)
    const id = createTabAndShow({ title: '下载管理', url }, win, afterTabId)
    if (id) {
      const tab = tabs.find((t) => t.id === id)
      if (tab) insertTab({ id, title: tab.title, url: tab.url, time: tab.time! })
    }
    return id
  })

  // 创建设置页
  ipcMain.handle('tabs:createSettings', async (_event, afterTabId?: string) => {
    const url = env.getSettingsUrl()
    console.log('[createSettings] 加载 URL:', url)
    const id = createTabAndShow({ title: '设置', url }, win, afterTabId)
    if (id) {
      const tab = tabs.find((t) => t.id === id)
      if (tab) insertTab({ id, title: tab.title, url: tab.url, time: tab.time! })
    }
    return id
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

  // 历史相关
  ipcMain.handle('history:get', async () => {
    return getHistory()
  })

  ipcMain.handle('history:clear', async () => {
    clearAllHistory()
    return true
  })

  ipcMain.handle('history:delete', async (_event, id: number) => {
    deleteRecord(id)
    return true
  })

  // 设置相关
  ipcMain.handle('settings:get', async (_event, key: string) => {
    return getSetting(key)
  })

  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    setSetting(key, value)
    // 主题变化时只广播给内部页面
    if (key === 'theme') {
      win.webContents.send('settings:theme-changed', value)
      for (const [, tab] of webContentViewMap) {
        if (isInternalTab(tab)) {
          tab.view.webContents.send('settings:theme-changed', value)
        }
      }
    }
    return true
  })

  ipcMain.handle('settings:getAll', async () => {
    return getAllSettings()
  })

  // AI 会话相关
  ipcMain.handle('ai:list', async (_event, options?: { limit?: number; offset?: number }) => {
    if (options?.limit !== undefined) {
      return getChatSessionsPage(options.limit, options.offset ?? 0)
    }
    return getAllChatSessions()
  })

  ipcMain.handle('ai:create', async (_event, title?: string) => {
    return createChatSession(title)
  })

  ipcMain.handle('ai:updateTitle', async (_event, convId: string, title: string) => {
    updateTitle(convId, title)
    return true
  })

  ipcMain.handle('ai:updateMessages', async (_event, convId: string, messages: any[]) => {
    updateMessages(convId, messages)
    return true
  })

  ipcMain.handle('ai:delete', async (_event, convId: string) => {
    deleteChatSession(convId)
    return true
  })

  ipcMain.handle('ai:updatePinned', async (_event, convId: string, pinned: number) => {
    updatePinned(convId, pinned)
    return true
  })

  ipcMain.handle('ai:getModel', async () => {
    return getSetting('ai_model') || 'mimo-v2.5-pro'
  })

  ipcMain.handle('ai:saveFile', async (_event, content: string, filename: string) => {
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new Error('非法文件名')
    }
    const saveDir = app.getPath('downloads')
    const filePath = path.join(saveDir, filename)
    await fs.promises.writeFile(filePath, content, 'utf-8')
    return filePath
  })

  // 打开当前 Tab 的开发者工具
  ipcMain.on('tabs:openDevTools', () => {
    openDevToolsForCurTab()
  })

  // 日志文件相关
  ipcMain.handle('logs:list', () => {
    const logDir = app.getPath('logs')
    try {
      const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log'))
      return files
    } catch {
      return []
    }
  })

  ipcMain.handle('logs:read', (_event, filename: string, limit?: number) => {
    const logDir = app.getPath('logs')
    const filePath = path.join(logDir, filename)
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      const maxLines = limit ?? 200
      return lines.slice(-maxLines).join('\n')
    } catch {
      return ''
    }
  })

  ipcMain.handle('logs:dir', () => {
    return app.getPath('logs')
  })

  // 下载管理器 IPC handlers
  registerDownloadHandlers()
}
