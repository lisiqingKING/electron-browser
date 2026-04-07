import { ipcMain, BrowserWindow } from 'electron'
import path from 'node:path'
import { getCurTab, createTabCore, webContentViewMap, updateCurTabBounds, DEFAULT_TAB, TabInfo, closeTab, setCurTabId } from './tabCore'
import { registerWebContentsEvents } from './tabEvents'
import { goBack, goForward, refreshCurTab, updateCurTabUrl, createTabAndShow, updateNavigationState } from './tabNavigation'
import { getHistory, clearAllHistory, deleteRecord } from '../history/historyManager'

// Re-export for external use
export { webContentViewMap, updateCurTabBounds, getCurTab } from './tabCore'
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

    if (tabInfo.url.startsWith('http')) {
      view.webContents.loadURL(tabInfo.url)
    } else {
      view.webContents.loadFile(tabInfo.url)
    }

    win.contentView.addChildView(view)
    updateCurTabBounds(webContentViewMap.get(enrichedTabInfo.id!)!, win)
    win.webContents.send('tab:list-changed')
    return true
  })

  // 创建默认页
  ipcMain.handle('tabs:createDefault', async () => {
    const curTab = getCurTab()
    if (curTab?.view) {
      win.contentView.removeChildView(curTab.view)
    }

    const tabInfo: TabInfo = {
      title: DEFAULT_TAB.title,
      url: path.join(process.env.APP_ROOT!, DEFAULT_TAB.url)
    }

    const { view, tabInfo: enrichedTabInfo } = createTabCore(tabInfo)
    registerWebContentsEvents(view, enrichedTabInfo, win)
    view.webContents.loadFile(tabInfo.url)

    win.contentView.addChildView(view)
    updateCurTabBounds(webContentViewMap.get(enrichedTabInfo.id!)!, win)
    return true
  })

  // 创建历史页
  ipcMain.handle('tabs:createHistory', async () => {
    const curTab = getCurTab()
    if (curTab?.view) {
      win.contentView.removeChildView(curTab.view)
    }

    const tabInfo: TabInfo = {
      title: '历史记录',
      url: path.join(process.env.APP_ROOT!, 'history.html')
    }

    const { view, tabInfo: enrichedTabInfo } = createTabCore(tabInfo)
    registerWebContentsEvents(view, enrichedTabInfo, win)
    view.webContents.loadFile(tabInfo.url)

    win.contentView.addChildView(view)
    updateCurTabBounds(webContentViewMap.get(enrichedTabInfo.id!)!, win)
    return true
  })

  // 刷新
  ipcMain.on('tabs:refresh', () => {
    refreshCurTab(win)
  })

  // 更新URL
  ipcMain.on('tabs:updateUrl', (_event, url: string) => {
    updateCurTabUrl(url, win)
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
      setCurTabId(tabId) // 更新当前 tab id
      updateNavigationState(tabId, win) // 发送导航状态
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
}
