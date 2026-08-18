import { ipcMain, BrowserWindow, dialog, shell, app } from 'electron'
import { ipcLogger } from '../shared/logger'
import { closeWindow, getAllWindows, activateReserveWindow } from '../windows/windowManager'
import { getSetting as getSettingsValue } from '../modules/settings/manager'
import { getTabContext, getTabListData, switchTab, addTabToWindow, removeTabFromWindow } from '../tabs/state'
import { getTabEntry, getTabBrowserWindow } from '../tabs/state/windowTabs'
import { env } from '../shared/env'
import { createTabAndShow, resolveAppsUrl } from '../tabs/tabNavigation'
import { setupWindow } from './windowEvents'
import { createTabView } from '../tabs/state/tabCore'
import { registerWebContentsEvents } from '../tabs/tabEvents'
import { isUrl } from '@renderer/utils'

export function registerWindowIpc() {
  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })
  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })
  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) closeWindow(win)
  })
  ipcMain.handle('window:isMaximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isMaximized() ?? false
  })

  ipcMain.handle('window:create', () => {
    const win = activateReserveWindow()
    setupWindow(win)
    const appUrl = env.getAppUrl()
    createTabAndShow({ title: '首页', url: appUrl, isHome: true }, win)
    return true
  })

  ipcMain.handle('window:list', () => {
    return getAllWindows().map(win => ({
      id: win.id,
      tabs: getTabContext(win).tabs.length,
      isFocused: win.isFocused()
    }))
  })

  let lastAdoptTime = 0

  ipcMain.handle('window:adopt-tab', (_event, tabId: string, screenPos?: { x: number; y: number }) => {
    const now = Date.now()
    if (now - lastAdoptTime < 500) return false
    lastAdoptTime = now

    const tabEntry = getTabEntry(tabId)
    if (!tabEntry) {
      ipcLogger.error(`window:adopt-tab failed - tab not found: ${tabId}`)
      return false
    }
    const oldWin = getTabBrowserWindow(tabId)
    if (!oldWin) {
      ipcLogger.error(`window:adopt-tab failed - browser window not found for tab: ${tabId}`)
      return false
    }
    const oldCurTabId = getTabContext(oldWin).curTabId
    let { view } = tabEntry

    const newWin = activateReserveWindow()
    if (newWin.isDestroyed()) return false

    // 如果 view 不存在（懒加载 tab），先创建 view
    if (!view) {
      view = createTabView(tabEntry.tabInfo, newWin)
      registerWebContentsEvents(view, tabEntry.tabInfo, newWin)
      const resolvedUrl = resolveAppsUrl(tabEntry.tabInfo.url)
      if (isUrl(resolvedUrl)) {
        view.webContents.loadURL(resolvedUrl)
      } else {
        view.webContents.loadFile(resolvedUrl)
      }
    }

    // 定位窗口到鼠标位置（仅拖拽场景）
    if (screenPos) {
      newWin.setPosition(screenPos.x - Math.floor(newWin.getSize()[0] / 2), screenPos.y - 48)
    }

    // 清空新窗口的非 home tab（reserveWindow 可能有残留）
    const newCtx = getTabContext(newWin)
    const homeTab = newCtx.tabs.find(t => t.isHome)
    const homeEntry = homeTab ? newCtx.webContentViewMap.get(homeTab.id!) : undefined
    newCtx.tabs = []
    newCtx.webContentViewMap.clear()
    if (homeTab) {
      newCtx.tabs.push(homeTab)
      if (homeEntry) newCtx.webContentViewMap.set(homeTab.id!, homeEntry)
    }

    // 从旧窗口移除 tab
    oldWin.contentView.removeChildView(view)
    const closedIndex = getTabContext(oldWin).tabs.findIndex(t => t.id === tabId)
    const removed = removeTabFromWindow(tabId, oldWin)
    if (!removed) return false

    // 添加到新窗口
    addTabToWindow(removed.tabInfo, view, newWin)

    // 通知旧窗口切换 tab（切换到被移除tab左侧的tab）
    const oldCtx = getTabContext(oldWin)
    if (oldCurTabId === tabId && oldCtx.tabs.length > 0) {
      const nextIndex = Math.max(0, closedIndex - 1)
      const nextTab = oldCtx.tabs[nextIndex]
      if (nextTab.id) switchTab(nextTab.id, oldWin)
    }
    if (!oldWin.isDestroyed()) {
      oldWin.webContents.send('tab:list-changed', getTabListData(oldWin))
    }
    if (!newWin.isDestroyed()) {
      newWin.webContents.send('tab:list-changed', getTabListData(newWin))
    }

    return true
  })

  ipcMain.handle('window:selectDownloadDir', async (_event, currentPath: string) => {
    const result = await dialog.showOpenDialog({
      title: '选择下载文件夹',
      defaultPath: currentPath,
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle('window:openPath', async (_event, fullPath: string) => {
    return shell.openPath(fullPath)
  })

  ipcMain.handle('window:getDownloadDir', () => {
    const saved = getSettingsValue('download_save_dir')
    return saved || app.getPath('downloads')
  })
}
