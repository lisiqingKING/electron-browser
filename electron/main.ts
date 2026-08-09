import { app, BrowserWindow, protocol, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createTabAndShow } from './tabs/tabHandlers'
import { registerShortcuts } from './windows/keyboard/shortcuts'
import { initDatabase, closeDatabase } from './shared/database/index'
import { saveTabs, loadTabs } from './features/tabs/tabsDb'
import { syncFromDb as syncFavoritesFromDb } from './features/favorites/favoritesManager'
import { env } from './shared/env'
import { startSubappServer, stopSubappServer, getSubappUrl } from './subapp-server'
import { getDownloadManager } from './features/downloads/downloadManager'
import { initWebviewSource } from './features/downloads/sources/webviewSource'
import { registerMemoryMonitorHandler, getMemoryMonitor } from './shared/memory/memoryMonitor'
import { createAlertHandler } from './shared/memory/alertLogger'
import { createTray, destroyTray } from './windows/tray/trayManager'
import { registerPopupHandlers } from './popup'
import { updater, updaterChannels } from './features/updater'
import { registerAllHandlers } from './bootstrap'
import { createWindow, closeWindow, ensureReserveWindow, getAllWindows, activateReserveWindow, setWindowAsCurrentMain } from './modules/windowManager'
import { getTabContext, getTabListData, createTabCore, updateCurTabBounds, getCurTab, switchTab } from './modules/tabContext'
import { getTabEntry, moveTabToWindow } from './modules/tabRegistry'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

function setupWindow(win: BrowserWindow) {
  registerShortcuts(win)

  win.on('resize', () => {
    const curTab = getCurTab(win)
    if (curTab?.view) updateCurTabBounds(curTab, win)
  })
}

function restoreTabs(win: BrowserWindow, _homeTabId: string) {
  const saved = loadTabs()
  if (saved.tabs.length > 0) {
    for (const savedTab of saved.tabs) {
      try {
        createTabCore(
          { title: savedTab.title, url: savedTab.url },
          win,
          undefined,
          savedTab.id,
          true // lazyView: 不立即创建视图和加载
        )
      } catch (err) {
        console.error('[restoreTabs] 恢复标签失败:', savedTab.url, err)
      }
    }

    win.webContents.send('tab:list-changed', getTabListData(win))

    if (saved.currentTabId) {
      switchTab(saved.currentTabId, win)
    }
  }
}

function createMainWindow(): BrowserWindow {
  const win = createWindow({ show: true })

  setupWindow(win)
  registerAllHandlers()

  if (VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools()
  }

  createTray()

  const appUrl = env.getAppUrl()
  const homeTabId = createTabAndShow({ title: '首页', url: appUrl, isHome: true }, win)

  restoreTabs(win, homeTabId!)

  return win
}

app.on('window-all-closed', () => {
  // 不自动退出，让托盘保持应用运行
})

function collectTabsForSave(): { tabs: { id?: string; title: string; url: string; time?: number; isHome?: boolean }[]; currentTabId: string | null } {
  const allTabs: { id?: string; title: string; url: string; time?: number; isHome?: boolean }[] = []
  let currentTabId: string | null = null

  for (const win of getAllWindows()) {
    if (win.isDestroyed()) continue
    const ctx = getTabContext(win)
    for (const tab of ctx.tabs) {
      if (!tab.loadError) {
        allTabs.push(tab)
        if (ctx.curTabId === tab.id) {
          currentTabId = tab.id
        }
      }
    }
  }

  return { tabs: allTabs, currentTabId }
}

app.on('before-quit', () => {
  const { tabs, currentTabId } = collectTabsForSave()
  saveTabs(tabs, currentTabId)
})

app.on('will-quit', () => {
  destroyTray()
  getMemoryMonitor().stopMonitor()
  closeDatabase()
  stopSubappServer()
  void getDownloadManager().shutdown()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow()
  }
})

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.exit(0)
}

app.whenReady().then(async () => {
  app.on('second-instance', () => {
    const win = activateReserveWindow()
    setWindowAsCurrentMain(win)
    setupWindow(win)
    const appUrl = env.getAppUrl()
    createTabAndShow({ title: '首页', url: appUrl, isHome: true }, win)
  })

  await startSubappServer()

  protocol.handle('lsqapp', async (request) => {
    const url = request.url
    const parsed = new URL(url)
    const appName = parsed.hostname
    const route = parsed.pathname.slice(1) || ''
    const redirectUrl = getSubappUrl(appName, `index.html#/${route}`)
    return Response.redirect(redirectUrl, 302)
  })

  protocol.handle('open-lsqapp', async (request) => {
    const url = request.url
    const parsed = new URL(url)
    const target = parsed.pathname.slice(1)
    const redirectUrl = getSubappUrl('internal-app', `index.html#/${target}`)
    return Response.redirect(redirectUrl, 302)
  })

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

  ipcMain.handle('tab:move-to-window', async (_event, tabId: string) => {
    try {
    const oldWin = BrowserWindow.fromWebContents(_event.sender)
    if (!oldWin || oldWin.isDestroyed()) return false

    const tabEntry = getTabEntry(tabId)
    if (!tabEntry) return false

    const { view, tabInfo } = tabEntry
    // 不能移动没有视图的 lazy tab
    if (!view) return false

    const oldCtx = getTabContext(oldWin)
    const oldCurTabId = oldCtx.curTabId

    // 1. 激活预备窗口（窗口显示，渲染进程收到初始 tab:list-changed）
    const newWin = activateReserveWindow()
    if (newWin.isDestroyed()) return false
    setupWindow(newWin)

    // 2. 在新窗口 context 创建 tab（不重建 view）
    const newCtx = getTabContext(newWin)
    newCtx.tabs.push(tabInfo)
    newCtx.webContentViewMap.set(tabId, { info: tabInfo, view })
    newCtx.curTabId = tabId

    // 3. 移动视图
    oldWin.contentView.removeChildView(view)
    newWin.contentView.addChildView(view)
    updateCurTabBounds({ info: tabInfo, view }, newWin)

    // 4. 更新 tabRegistry 指向新窗口
    moveTabToWindow(tabId, newWin)

    // 5. 从旧窗口 context 移除 tab（不销毁 view，因为 view 已转移）
    const removeIdx = oldCtx.tabs.findIndex(t => t.id === tabId)
    if (removeIdx !== -1) {
      oldCtx.tabs.splice(removeIdx, 1)
    }
    oldCtx.webContentViewMap.delete(tabId)

    // 如果被移除的是当前 tab，需要切换到上一个（被移除位置的前一个）
    if (oldCurTabId === tabId) {
      if (removeIdx > 0) {
        const newCurTab = oldCtx.tabs[removeIdx - 1]
        if (newCurTab.id) {
          switchTab(newCurTab.id, oldWin)
        }
        if (!oldWin.isDestroyed()) {
          oldWin.webContents.send('tab:current-changed', { currentTabId: oldCtx.curTabId })
        }
      } else if (oldCtx.tabs.length > 0) {
        // 移除的是第一个，切换到新的第一个
        const newCurTab = oldCtx.tabs[0]
        if (newCurTab.id) {
          switchTab(newCurTab.id, oldWin)
        }
        if (!oldWin.isDestroyed()) {
          oldWin.webContents.send('tab:current-changed', { currentTabId: oldCtx.curTabId })
        }
      } else {
        oldCtx.curTabId = null
      }
    }

    // 6. 推送更新
    if (!newWin.isDestroyed()) {
      newWin.webContents.send('tab:list-changed', getTabListData(newWin))
    }
    if (!oldWin.isDestroyed()) {
      oldWin.webContents.send('tab:list-changed', getTabListData(oldWin))
    }

    return true
    } catch (err) {
      console.error('[tab:move-to-window] error:', err)
      return false
    }
  })

  initDatabase()
  syncFavoritesFromDb()
  initWebviewSource()
  registerMemoryMonitorHandler()
  registerPopupHandlers()

  const monitor = getMemoryMonitor()
  monitor.setAlertHandler(createAlertHandler())

  getDownloadManager().init()
  createMainWindow()
  ensureReserveWindow()
  monitor.startMonitor()

  updater.init()
  ipcMain.handle(updaterChannels.checkForUpdates, () => updater.checkForUpdates())
  ipcMain.handle(updaterChannels.downloadUpdate, () => updater.downloadUpdate())
  ipcMain.handle(updaterChannels.quitAndInstall, () => updater.quitAndInstall())
  ipcMain.handle(updaterChannels.getUpdateStatus, () => updater.getStatus())
  setTimeout(() => updater.checkForUpdates(), 1 * 60 * 1000)
})
