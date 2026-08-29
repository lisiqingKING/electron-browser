import { startSubappServer } from '../subapp-server'
import { initDatabase } from '../shared/database/index'
import { syncFromDb as syncFavoritesFromDb } from '../modules/favorites/manager'
import { initWebviewSource } from '../modules/downloads/manager/sources/webviewSource'
import { registerPopupHandlers } from '../modules/popup'
import { registerAllHandlers } from '../bootstrap'
import { ensureReserveWindow, createWindow } from '../windows/windowManager'
import { getDownloadManager } from '../modules/downloads/manager'
import { registerWindowEvents, setupWindow } from './windowEvents'
import { registerProtocol } from './protocol'
import { registerWindowIpc } from './windowHandlers'
import { env } from '../shared/env'
import { createTabAndShow } from '../tabs/tabNavigation'
import { createTray } from '../windows/tray/trayManager'
import { getTabListData, switchTab, getTabContext } from '../tabs/state'
import { nativeTheme } from 'electron'
import { getSetting } from '../modules/settings/manager'
import type { Theme } from '../shared/types'

function restoreTabs(win: Electron.BrowserWindow) {
  const ctx = getTabContext(win)
  const homeTab = ctx.tabs.find(t => t.isHome)
  if (homeTab?.id) {
    switchTab(homeTab.id, win)
    win.webContents.send('tab:list-changed', getTabListData(win))
  }
}

export function createMainWindow(): Electron.BrowserWindow {
  const win = createWindow({ show: true, isMain: true })

  setupWindow(win)

  if (process.env.VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools()
  }

  restoreTabs(win)

  const ctx = getTabContext(win)
  if (ctx.tabs.length === 0) {
    const appUrl = env.getAppUrl()
    createTabAndShow({ title: '首页', url: appUrl, isHome: true }, win)
  }

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
  registerPopupHandlers()
  registerAllHandlers()

  getDownloadManager().init()

  const savedTheme = getSetting('theme') || 'dark'
  nativeTheme.themeSource = savedTheme as Theme

  createMainWindow()
  ensureReserveWindow()
}
