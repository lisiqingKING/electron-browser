import { ipcMain } from 'electron'
import { startSubappServer } from '../subapp-server'
import { initDatabase } from '../shared/database/index'
import { syncFromDb as syncFavoritesFromDb } from '../features/favorites/favoritesManager'
import { initWebviewSource } from '../features/downloads/sources/webviewSource'
import { registerMemoryMonitorHandler, getMemoryMonitor } from '../shared/memory/memoryMonitor'
import { createAlertHandler } from '../shared/memory/alertLogger'
import { registerPopupHandlers } from '../popup'
import { registerAllHandlers } from '../bootstrap'
import { ensureReserveWindow, createWindow } from '../windows/windowManager'
import { getDownloadManager } from '../features/downloads/downloadManager'
import { updater, updaterChannels } from '../features/updater'
import { registerWindowEvents, setupWindow } from './windowEvents'
import { registerProtocol } from './protocol'
import { registerWindowIpc } from './windowHandlers'
import { env } from '../shared/env'
import { createTabAndShow } from '../tabs/tabNavigation'
import { createTray } from '../windows/tray/trayManager'
import { loadTabs } from '../tabs/tabsDb'
import { createTabCore, getTabListData, switchTab } from '../tabs/state'

function restoreTabs(win: Electron.BrowserWindow) {
  const saved = loadTabs()
  if (saved.tabs.length > 0) {
    for (const savedTab of saved.tabs) {
      try {
        createTabCore(
          { title: savedTab.title, url: savedTab.url },
          win,
          undefined,
          savedTab.id,
          true
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

export function createMainWindow(): Electron.BrowserWindow {
  const win = createWindow({ show: true })

  setupWindow(win)

  if (process.env.VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools()
  }

  const appUrl = env.getAppUrl()
  createTabAndShow({ title: '首页', url: appUrl, isHome: true }, win)

  restoreTabs(win)

  createTray()

  return win
}

export async function appReadyInit() {
  registerWindowEvents()
  registerProtocol()
  registerWindowIpc()

  await startSubappServer()

  initDatabase()
  syncFavoritesFromDb()
  initWebviewSource()
  registerMemoryMonitorHandler()
  registerPopupHandlers()
  registerAllHandlers()

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
}
