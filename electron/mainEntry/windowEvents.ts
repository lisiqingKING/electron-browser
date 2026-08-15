import { app, BrowserWindow } from 'electron'
import { activateReserveWindow, setWindowAsCurrentMain } from '../windows/windowManager'
import { getTabContext, updateCurTabBounds } from '../tabs/state'
import { destroyTray } from '../windows/tray/trayManager'
import { closeDatabase } from '../shared/database/index'
import { stopSubappServer } from '../subapp-server'
import { getDownloadManager } from '../modules/downloads/manager'
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

export function registerWindowEvents() {
  app.on('window-all-closed', () => {
    // 不自动退出，让托盘保持应用运行
  })

  app.on('will-quit', () => {
    destroyTray()
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
