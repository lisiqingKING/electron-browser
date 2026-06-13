import { ipcMain, BrowserWindow } from 'electron'
import { getCurTab, createTabCore, webContentViewMap, updateCurTabBounds, DEFAULT_TAB, TabInfo, closeTab, setCurTabId, openDevToolsForCurTab } from './tabCore'
import { registerWebContentsEvents } from './tabEvents'
import { goBack, goForward, refreshCurTab, updateCurTabUrl, createTabAndShow } from './tabNavigation'
import { getHistory, clearAllHistory, deleteRecord } from '../history/historyManager'
import {
  getAllChatSessions,
  createChatSession,
  updateTitle,
  updateMessages,
  deleteChatSession,
} from '../ai/aiConversationManager'
import { env } from '../env'
import { getSubappUrl } from '../subapp'

function resolveAppsUrl(url: string): string | null {
  if (!url.startsWith('apps://')) return null
  try {
    const parsed = new URL(url)
    const subapp = parsed.hostname
    const route = parsed.pathname || '/'
    // apps://app/home -> http://localhost:端口/app/index.html#/home
    const fullPath = route === '/' ? '' : route
    return getSubappUrl(subapp, `index.html#${fullPath}`)
  } catch {
    return null
  }
}

// Re-export for external use
export { webContentViewMap, updateCurTabBounds, getCurTab, openDevToolsForCurTab } from './tabCore'
export { createTabAndShow }

export function registerTabHandlers(win: BrowserWindow) {
  // 列表
  ipcMain.handle('tabs:list', async () => {
    return [...webContentViewMap.values()].map(item => item.info)
  })

  // 创建普通标签页
  ipcMain.handle('tabs:create', async (_event, tabInfo: { title: string; url: string }) => {
    const curTab = getCurTab()
    if (curTab?.view) {
      win.contentView.removeChildView(curTab.view)
    }

    const { view, tabInfo: enrichedTabInfo } = createTabCore(tabInfo)
    registerWebContentsEvents(view, enrichedTabInfo, win)

    // 解析 ligbox:// 协议
    const ligboxUrl = resolveAppsUrl(tabInfo.url)
    if (ligboxUrl) {
      view.webContents.loadURL(ligboxUrl)
    } else if (tabInfo.url.startsWith('http') || tabInfo.url.startsWith('lsqapp://')) {
      view.webContents.loadURL(tabInfo.url)
    } else {
      view.webContents.loadFile(tabInfo.url)
    }

    win.contentView.addChildView(view)
    updateCurTabBounds(webContentViewMap.get(enrichedTabInfo.id!)!, win)
    win.webContents.send('tab:list-changed')
    return enrichedTabInfo.id
  })

  // 创建默认页
  ipcMain.handle('tabs:createDefault', async () => {
    const url = env.getAppUrl()
    console.log('[createDefault] 加载 URL:', url)

    const curTab = getCurTab()
    if (curTab?.view) {
      win.contentView.removeChildView(curTab.view)
    }

    const tabInfo: TabInfo = {
      title: DEFAULT_TAB.title,
      url: url
    }

    const { view, tabInfo: enrichedTabInfo } = createTabCore(tabInfo)
    registerWebContentsEvents(view, enrichedTabInfo, win)

    view.webContents.loadURL(url)

    win.contentView.addChildView(view)
    updateCurTabBounds(webContentViewMap.get(enrichedTabInfo.id!)!, win)
    win.webContents.send('tab:list-changed')
    return enrichedTabInfo.id
  })

  // 创建历史页
  ipcMain.handle('tabs:createHistory', async () => {
    const url = env.getHistoryUrl()
    console.log('[createHistory] 加载 URL:', url)

    const curTab = getCurTab()
    if (curTab?.view) {
      win.contentView.removeChildView(curTab.view)
    }

    const tabInfo: TabInfo = {
      title: '历史记录',
      url: url
    }

    const { view, tabInfo: enrichedTabInfo } = createTabCore(tabInfo)
    registerWebContentsEvents(view, enrichedTabInfo, win)

    view.webContents.loadURL(url)

    win.contentView.addChildView(view)
    updateCurTabBounds(webContentViewMap.get(enrichedTabInfo.id!)!, win)
    win.webContents.send('tab:list-changed')
    return enrichedTabInfo.id
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
}