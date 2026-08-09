import { ipcMain, BrowserWindow } from 'electron'
import { showPopup, hidePopup, PopupOptions, popupSourceMap } from './popupWindow'

export function registerPopupHandlers(): void {
  ipcMain.on('popup:show', (_event, options: PopupOptions) => {
    const win = BrowserWindow.fromWebContents(_event.sender)
    if (!win || win.isDestroyed()) return
    showPopup(options, win)
  })

  ipcMain.on('popup:hide', () => {
    hidePopup()
  })

  ipcMain.on('popup:action', (_event, data: { action: string; context?: any }) => {
    console.log('[popup:action] received:', data.action, data.context)
    const sourceWindowId = popupSourceMap.get(_event.sender.id)
    const win = sourceWindowId ? BrowserWindow.fromId(sourceWindowId) : null
    if (win && !win.isDestroyed()) {
      win.webContents.send('popup:action', data)
    } else {
      console.warn('[popup:action] source window not available, action dropped:', data.action)
    }
  })
}