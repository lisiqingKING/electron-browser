import { ipcMain, BrowserWindow } from 'electron'
import { showPopup, hidePopup, popupSourceMap } from './manager'
import { popupChannels } from './channels'

export function registerPopupHandlers(): void {
  ipcMain.on(popupChannels.show, (_event, options) => {
    const win = BrowserWindow.fromWebContents(_event.sender)
    if (!win || win.isDestroyed()) return
    showPopup(options, win)
  })

  ipcMain.on(popupChannels.hide, () => {
    hidePopup()
  })

  ipcMain.on(popupChannels.action, (_event, data: { action: string; context?: any }) => {
    const sourceWindowId = popupSourceMap.get(_event.sender.id)
    const win = sourceWindowId ? BrowserWindow.fromId(sourceWindowId) : null
    if (win && !win.isDestroyed()) {
      win.webContents.send('popup:action', data)
    }
  })
}
