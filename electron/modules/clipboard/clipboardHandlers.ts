import { ipcMain, clipboard } from 'electron'
import { ipcLogger } from '../../shared/logger'

export function registerClipboardHandlers() {
  ipcMain.handle('clipboard:writeText', (_event, text: string) => {
    try {
      clipboard.writeText(text)
    } catch (err) {
      ipcLogger.error('[clipboard] writeText failed:', err)
    }
  })

  ipcMain.handle('clipboard:readText', () => {
    try {
      return clipboard.readText()
    } catch (err) {
      ipcLogger.error('[clipboard] readText failed:', err)
      return ''
    }
  })
}