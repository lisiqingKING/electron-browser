import { ipcMain, BrowserWindow, app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { getCurTab, webContentViewMap, updateCurTabBounds, closeTab, setCurTabId, openDevToolsForCurTab } from './tabCore'
import { goBack, goForward, refreshCurTab, updateCurTabUrl, createTabAndShow, resolveAppsUrl } from './tabNavigation'
import { getHistory, clearAllHistory, deleteRecord } from '../history/historyManager'
import {
  getAllChatSessions,
  createChatSession,
  updateTitle,
  updateMessages,
  deleteChatSession,
} from '../ai/aiConversationManager'
import { env } from '../env'
import { registerDownloadHandlers } from '../downloads/downloadHandlers'

export { webContentViewMap, updateCurTabBounds, getCurTab, openDevToolsForCurTab } from './tabCore'
export { createTabAndShow }

export function registerTabHandlers(win: BrowserWindow) {
  // 列表
  ipcMain.handle('tabs:list', async () => {
    return [...webContentViewMap.values()].map(item => item.info)
  })

  // 创建普通标签页
  ipcMain.handle('tabs:create', async (_event, tabInfo: { title: string; url: string }) => {
    return createTabAndShow(tabInfo, win)
  })

  // 创建首页（常驻不可关闭）
  ipcMain.handle('tabs:createHome', async () => {
    // 已有首页则不重复创建
    const existing = [...webContentViewMap.values()].find(t => t.info.isHome)
    if (existing) return existing.info.id

    const url = env.getAppUrl()
    console.log('[createHome] 加载 URL:', url)
    return createTabAndShow({ title: '首页', url, isHome: true }, win)
  })

  // 创建新标签页（搜索页）
  ipcMain.handle('tabs:createDefault', async () => {
    const url = env.getNewTabUrl()
    console.log('[createDefault] 加载 URL:', url)
    return createTabAndShow({ title: '新标签页', url }, win)
  })

  // 创建历史页
  ipcMain.handle('tabs:createHistory', async () => {
    const url = env.getHistoryUrl()
    console.log('[createHistory] 加载 URL:', url)
    return createTabAndShow({ title: '历史记录', url }, win)
  })

  // 创建下载管理页 (dev 走 Vite, packaged 走 lsqapp:// 协议)
  ipcMain.handle('tabs:createDownloads', async () => {
    const url = env.getDownloadsUrl()
    console.log('[createDownloads] 加载 URL:', url)
    return createTabAndShow({ title: '下载管理', url }, win)
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
    }
    return true
  })

  // 关闭标签
  ipcMain.handle('tabs:close', async (_event, tabId: string) => {
    const newCurTabId = closeTab(tabId, win)
    win.webContents.send('tab:list-changed', newCurTabId)
    return newCurTabId
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

  // AI 会话相关
  ipcMain.handle('ai:list', async () => {
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
