import { ipcMain } from 'electron'
import { showPopup, hidePopup, PopupOptions, getMainWindow } from './popupWindow'

export function registerPopupHandlers(): void {
  ipcMain.on('popup:show', (_event, options: PopupOptions) => {
    showPopup(options)
  })

  ipcMain.on('popup:hide', () => {
    hidePopup()
  })

  ipcMain.on('popup:action', (_event, data: { action: string; context?: any }) => {
    console.log('[popup:action] received:', data.action, data.context)
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('popup:action', data)
    } else {
      console.warn('[popup:action] main window not available, action dropped:', data.action)
    }
  })
}
