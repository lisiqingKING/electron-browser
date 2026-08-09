import { ipcMain, BrowserWindow } from 'electron'
import { closeWindow, getAllWindows, activateReserveWindow } from '../windows/windowManager'
import { getTabContext } from '../tabs/state'
import { env } from '../shared/env'
import { createTabAndShow } from '../tabs/tabNavigation'
import { setupWindow } from './windowEvents'

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
}
