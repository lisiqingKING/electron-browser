import { ipcMain, BrowserWindow } from 'electron'
import { ipcLogger } from '../../shared/logger'
import { showPopup, hidePopup } from './manager'
import { popupChannels } from './channels'
import { getWindowById } from '../../shared/windowUtils'

export function registerPopupHandlers(): void {
  ipcMain.on(popupChannels.show, (_event, options) => {
    const win = BrowserWindow.fromWebContents(_event.sender)
    if (!win || win.isDestroyed()) return
    showPopup(options, win)
  })

  ipcMain.on(popupChannels.hide, () => {
    hidePopup()
  })

  ipcMain.on(popupChannels.action, (_event, data: { action: string; context?: any; windowId?: number }) => {
    const win = getWindowById(data.windowId)
    if (!win || win.isDestroyed()) {
      ipcLogger.error(`popup:action failed - source window not found: ${data.windowId}`)
      return
    }
    win.webContents.send('popup:action', data)
  })
}
