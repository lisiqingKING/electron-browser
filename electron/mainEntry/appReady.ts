import { startSubappServer } from '../subapp-server'
import { initDatabase } from '../shared/database/index'
import { syncFromDb as syncFavoritesFromDb } from '../modules/favorites/manager'
import { initWebviewSource } from '../modules/downloads/manager/sources/webviewSource'
import { registerPopupHandlers } from '../modules/popup'
import { registerAllHandlers } from '../bootstrap'
import { ensureReserveWindow, createWindow } from '../windows/windowManager'
import { getDownloadManager } from '../modules/downloads/manager'
import { mainLogger } from '../shared/logger'
import { registerWindowEvents, setupWindow } from './windowEvents'
import { registerProtocol } from './protocol'
import { registerWindowIpc } from './windowHandlers'
import { env } from '../shared/env'
import { createTabAndShow } from '../tabs/tabNavigation'
import { createTray } from '../windows/tray/trayManager'
import { loadTabs } from '../tabs/tabsDb'
import { getCurrentTabId } from '../shared/windowConfig'
import { createTabCore, getTabListData, switchTab, getTabContext } from '../tabs/state'

function restoreTabs(win: Electron.BrowserWindow) {
  const savedTabs = loadTabs()
  const currentTabId = getCurrentTabId(win.id)

  if (savedTabs.length > 0) {
    // 有保存的 tab，恢复它们
    for (const savedTab of savedTabs) {
      try {
        createTabCore(
          { title: savedTab.title, url: savedTab.url, favicon: savedTab.favicon },
          win,
          undefined,
          savedTab.id,
          true
        )
      } catch (err) {
        mainLogger.error('恢复标签失败:', savedTab.url, err)
      }
    }

    // 切换到 currentTabId（如果存在且在恢复的 tabs 中），否则选中首页
    const ctx = getTabContext(win)
    const homeTabId = ctx.tabs.find(t => t.isHome)?.id
    const targetId = currentTabId && savedTabs.some(t => t.id === currentTabId)
      ? currentTabId
      : homeTabId ?? savedTabs[0]?.id ?? null

    if (targetId) {
      switchTab(targetId, win)
    }
    win.webContents.send('tab:list-changed', getTabListData(win))
  } else {
    // 没有保存的 tab，使用首页
    const ctx = getTabContext(win)
    const homeTab = ctx.tabs.find(t => t.isHome)
    if (homeTab?.id) {
      switchTab(homeTab.id, win)
      win.webContents.send('tab:list-changed', getTabListData(win))
    }
  }
}

export function createMainWindow(): Electron.BrowserWindow {
  const win = createWindow({ show: true })

  setupWindow(win)

  if (process.env.VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools()
  }

  restoreTabs(win)

  // 只有没有任何 tab 时才创建 home tab
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
  createMainWindow()
  ensureReserveWindow()
}
