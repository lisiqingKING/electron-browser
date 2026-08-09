import { app, BrowserWindow } from 'electron'
import { getAllWindows, activateReserveWindow, setWindowAsCurrentMain } from '../windows/windowManager'
import { getTabContext, updateCurTabBounds } from '../tabs/state'
import { destroyTray } from '../windows/tray/trayManager'
import { getMemoryMonitor } from '../shared/memory/memoryMonitor'
import { closeDatabase } from '../shared/database/index'
import { stopSubappServer } from '../subapp-server'
import { getDownloadManager } from '../features/downloads/downloadManager'
import { saveTabs } from '../tabs/tabsDb'
import { env } from '../shared/env'
import { createTabAndShow } from '../tabs/tabNavigation'
import { registerShortcuts } from '../windows/keyboard/shortcuts'

export function setupWindow(win: BrowserWindow) {
  registerShortcuts(win)

  win.on('resize', () => {
    const ctx = getTabContext(win)
    const curTabId = ctx.curTabId
    if (!curTabId) return
    const entry = ctx.webContentViewMap.get(curTabId)
    if (entry?.view) updateCurTabBounds(entry, win)
  })
}

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

export function registerWindowEvents() {
  app.on('window-all-closed', () => {
    // 不自动退出，让托盘保持应用运行
  })

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
      const { createMainWindow } = require('./appReady')
      createMainWindow()
    }
  })

  app.on('second-instance', () => {
    const win = activateReserveWindow()
    setWindowAsCurrentMain(win)
    setupWindow(win)
    const appUrl = env.getAppUrl()
    createTabAndShow({ title: '首页', url: appUrl, isHome: true }, win)
  })
}
