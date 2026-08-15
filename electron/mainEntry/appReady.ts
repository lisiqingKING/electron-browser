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
import { registerWindowEvents, setupWindow } from './windowEvents'
import { registerProtocol } from './protocol'
import { registerWindowIpc } from './windowHandlers'
import { env } from '../shared/env'
import { createTabAndShow, resolveAppsUrl } from '../tabs/tabNavigation'
import { registerWebContentsEvents } from '../tabs/tabEvents'
import { createTray } from '../windows/tray/trayManager'
import { loadTabs } from '../tabs/tabsDb'
import { getCurrentTabId } from '../shared/windowConfig'
import { createTabCore, getTabListData, switchTab, createTabView, getTabContext } from '../tabs/state'
import { isUrl } from '@renderer/utils'

function restoreTabs(win: Electron.BrowserWindow) {
  const savedTabs = loadTabs()
  let currentTabId = getCurrentTabId(win.id)
  console.log('[restoreTabs] savedTabs:', savedTabs.length, 'currentTabId:', currentTabId)

  // 如果 currentTabId 不在恢复的 tabs 里，用第一个 tab
  if (currentTabId && !savedTabs.some(t => t.id === currentTabId)) {
    console.log('[restoreTabs] currentTabId not found in savedTabs, falling back to first tab')
    currentTabId = savedTabs[0]?.id ?? null
  }

  if (savedTabs.length > 0) {
    for (const savedTab of savedTabs) {
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

    if (currentTabId) {
      switchTab(currentTabId, win)

      // 当前 tab 加载完成后，提前创建其他 tab 的 view 并加载 URL
      const activeTabEntry = getTabContext(win).webContentViewMap.get(currentTabId)
      if (activeTabEntry?.view) {
        activeTabEntry.view.webContents.once('did-finish-load', () => {
          const ctx = getTabContext(win)
          for (const tab of ctx.tabs) {
            if (tab.id === currentTabId) continue
            const entry = ctx.webContentViewMap.get(tab.id!)
            if (entry?.view) continue // 已经有 view，跳过
            try {
              const view = createTabView(tab, win)
              registerWebContentsEvents(view, tab, win)
              const resolvedUrl = resolveAppsUrl(tab.url)
              if (isUrl(resolvedUrl)) {
                view.webContents.loadURL(resolvedUrl)
              } else {
                view.webContents.loadFile(resolvedUrl)
              }
            } catch (err) {
              console.error('[restoreTabs] 预加载标签失败:', tab.url, err)
            }
          }
        })
      }
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
  registerMemoryMonitorHandler()
  registerPopupHandlers()
  registerAllHandlers()

  const monitor = getMemoryMonitor()
  monitor.setAlertHandler(createAlertHandler())

  getDownloadManager().init()
  createMainWindow()
  ensureReserveWindow()
  monitor.startMonitor()
}
